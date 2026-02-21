import { useQuery } from '@tanstack/react-query';

import type { AddressTokenBalance } from 'types/api/address';

import config from 'configs/app';

// JuiceSwap V3 contracts on Citrea (hardcoded)
const NFT_MANAGER = '0x3D3821D358f56395d4053954f98aec0E1F0fa568';
const FACTORY = '0xd809b1285add8eeaf1b1566bf31b2b4c4bba8e82';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ABI function selectors
const BALANCE_OF = '0x70a08231';
const TOKEN_OF_OWNER_BY_INDEX = '0x2f745c59';
const POSITIONS_SELECTOR = '0x99fbab88';
const GET_POOL = '0x1698ee82';
const SLOT0 = '0x3850c7bd';

interface RpcResponse {
  result?: string;
  error?: { message: string };
}

export interface JuiceSwapPosition {
  tokenId: number;
  token0Address: string;
  token1Address: string;
  amount0Wei: string;
  amount1Wei: string;
}

async function rpcCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [ { to, data }, 'latest' ],
      id: 1,
    }),
  });
  const json = await response.json() as RpcResponse;
  if (json.error) {
    throw new Error(json.error.message);
  }
  return json.result ?? '0x';
}

function padAddress(address: string): string {
  return address.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value: number): string {
  return value.toString(16).padStart(64, '0');
}

async function fetchJuiceSwapPositions(
  rpcUrl: string,
  address: string,
): Promise<Array<JuiceSwapPosition>> {
  // 1. balanceOf(address) on NFT Manager
  const balResult = await rpcCall(rpcUrl, NFT_MANAGER, BALANCE_OF + padAddress(address));
  const nftCount = parseInt(balResult, 16);

  if (!nftCount || nftCount === 0) {
    return [];
  }

  const positions: Array<JuiceSwapPosition> = [];
  const poolCache: Record<string, bigint> = {};
  const ownerPad = padAddress(address);

  for (let i = 0; i < nftCount; i++) {
    try {
      // 2. tokenOfOwnerByIndex(address, i) -> tokenId
      const tidResult = await rpcCall(
        rpcUrl, NFT_MANAGER,
        TOKEN_OF_OWNER_BY_INDEX + ownerPad + padUint256(i),
      );
      const tokenId = parseInt(tidResult, 16);

      // 3. positions(tokenId) -> 12 ABI-encoded fields
      const posResult = await rpcCall(
        rpcUrl, NFT_MANAGER,
        POSITIONS_SELECTOR + padUint256(tokenId),
      );
      const raw = posResult.slice(2);
      const fields: Array<string> = [];
      for (let j = 0; j < 12; j++) {
        fields.push(raw.slice(j * 64, (j + 1) * 64));
      }

      const token0 = '0x' + fields[2].slice(24);
      const token1 = '0x' + fields[3].slice(24);
      const fee = parseInt(fields[4], 16);

      // Decode signed int256 ticks
      const INT256_MAX = BigInt(1) << BigInt(255);
      const UINT256_RANGE = BigInt(1) << BigInt(256);
      const tickLowerRaw = BigInt('0x' + fields[5]);
      const tickLower = Number(tickLowerRaw >= INT256_MAX ? tickLowerRaw - UINT256_RANGE : tickLowerRaw);
      const tickUpperRaw = BigInt('0x' + fields[6]);
      const tickUpper = Number(tickUpperRaw >= INT256_MAX ? tickUpperRaw - UINT256_RANGE : tickUpperRaw);
      const liquidity = parseFloat(BigInt('0x' + fields[7]).toString());

      if (liquidity === 0) {
        continue;
      }

      // 4. getPool(token0, token1, fee) -> pool address, then slot0() for sqrtPriceX96
      const poolKey = `${ token0 }-${ token1 }-${ fee }`;
      if (!poolCache[poolKey]) {
        const poolResult = await rpcCall(
          rpcUrl, FACTORY,
          GET_POOL + padAddress(token0) + padAddress(token1) + padUint256(fee),
        );
        const poolAddr = '0x' + poolResult.slice(26);
        const slot0Result = await rpcCall(rpcUrl, poolAddr, SLOT0);
        poolCache[poolKey] = BigInt('0x' + slot0Result.slice(2, 66));
      }
      const sqrtPriceX96 = Number(poolCache[poolKey]);

      // 5. Uniswap V3 math to calculate token amounts from liquidity
      const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
      const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
      const sqrtPrice = sqrtPriceX96 / (2 ** 96);
      const currentTick = Math.log(sqrtPrice ** 2) / Math.log(1.0001);

      let amount0 = 0;
      let amount1 = 0;
      if (currentTick <= tickLower) {
        amount0 = liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB));
      } else if (currentTick > tickUpper) {
        amount1 = liquidity * (sqrtRatioB - sqrtRatioA);
      } else {
        amount0 = liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB));
        amount1 = liquidity * (sqrtPrice - sqrtRatioA);
      }

      positions.push({
        tokenId,
        token0Address: token0,
        token1Address: token1,
        amount0Wei: BigInt(Math.round(amount0)).toString(),
        amount1Wei: BigInt(Math.round(amount1)).toString(),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to fetch JuiceSwap position at index ${ i }:`, error);
    }
  }

  return positions;
}

/**
 * Creates virtual AddressTokenBalance items from JuiceSwap LP positions.
 * Each position produces 2 items (one per token in the pair).
 */
export function createLpTokenBalances(positions: Array<JuiceSwapPosition>): Array<AddressTokenBalance> {
  return positions.flatMap((pos) => [
    {
      token: {
        address_hash: pos.token0Address,
        type: 'ERC-20' as const,
        symbol: 'JUSD',
        name: `JuiceSwap LP #${ pos.tokenId }`,
        decimals: '18',
        holders_count: null,
        exchange_rate: null,
        total_supply: null,
        icon_url: null,
        circulating_market_cap: null,
        reputation: null,
      },
      token_id: `lp-${ pos.tokenId }-0`,
      value: pos.amount0Wei,
      token_instance: null,
    },
    {
      token: {
        address_hash: pos.token1Address,
        type: 'ERC-20' as const,
        symbol: 'WCBTC',
        name: `JuiceSwap LP #${ pos.tokenId }`,
        decimals: '18',
        holders_count: null,
        exchange_rate: null,
        total_supply: null,
        icon_url: null,
        circulating_market_cap: null,
        reputation: null,
      },
      token_id: `lp-${ pos.tokenId }-1`,
      value: pos.amount1Wei,
      token_instance: null,
    },
  ]);
}

export function useJuiceSwapPositions(addressHash?: string) {
  const rpcUrl = config.chain.rpcUrls?.[0];

  return useQuery({
    queryKey: [ 'juiceswap-positions', addressHash ],
    queryFn: () => fetchJuiceSwapPositions(rpcUrl ?? '', addressHash ?? ''),
    staleTime: STALE_TIME,
    refetchInterval: STALE_TIME,
    enabled: Boolean(rpcUrl) && Boolean(addressHash),
  });
}
