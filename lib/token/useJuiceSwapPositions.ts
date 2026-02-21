import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';

import type { AddressTokenBalance } from 'types/api/address';

import config from 'configs/app';
import { getEffectiveExchangeRate } from 'lib/token/stablecoins';

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
const SYMBOL_SELECTOR = '0x95d89b41';
const DECIMALS_SELECTOR = '0x313ce567';

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
  token0Symbol: string;
  token1Symbol: string;
}

export interface JuiceSwapPositionDetail extends JuiceSwapPosition {
  fee: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  inRange: boolean;
  token0Decimals: number;
  token1Decimals: number;
  token0Symbol: string;
  token1Symbol: string;
  liquidity: number;
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
  const symbolCache: Record<string, string> = {};
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

      // Fetch token symbols (cached per address)
      if (!symbolCache[token0]) {
        symbolCache[token0] = decodeString(await rpcCall(rpcUrl, token0, SYMBOL_SELECTOR)) || token0.slice(0, 10);
      }
      if (!symbolCache[token1]) {
        symbolCache[token1] = decodeString(await rpcCall(rpcUrl, token1, SYMBOL_SELECTOR)) || token1.slice(0, 10);
      }

      // Decode signed int256 ticks
      const INT256_MAX = BigInt(1) << BigInt(255);
      const UINT256_RANGE = BigInt(1) << BigInt(256);
      const tickLowerRaw = BigInt('0x' + fields[5]);
      const tickLower = Number(tickLowerRaw >= INT256_MAX ? tickLowerRaw - UINT256_RANGE : tickLowerRaw);
      const tickUpperRaw = BigInt('0x' + fields[6]);
      const tickUpper = Number(tickUpperRaw >= INT256_MAX ? tickUpperRaw - UINT256_RANGE : tickUpperRaw);
      const liquidity = parseFloat(BigInt('0x' + fields[7]).toString());

      let amount0 = 0;
      let amount1 = 0;

      if (liquidity > 0) {
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

        if (currentTick <= tickLower) {
          amount0 = liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB));
        } else if (currentTick > tickUpper) {
          amount1 = liquidity * (sqrtRatioB - sqrtRatioA);
        } else {
          amount0 = liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB));
          amount1 = liquidity * (sqrtPrice - sqrtRatioA);
        }
      }

      positions.push({
        tokenId,
        token0Address: token0,
        token1Address: token1,
        amount0Wei: BigInt(Math.round(amount0)).toString(),
        amount1Wei: BigInt(Math.round(amount1)).toString(),
        token0Symbol: symbolCache[token0],
        token1Symbol: symbolCache[token1],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to fetch JuiceSwap position at index ${ i }:`, error);
    }
  }

  return positions;
}

/**
 * Creates virtual token balance items from JuiceSwap LP positions.
 * Each position produces 1 ERC-721 item with the combined USD value.
 */
export function createLpTokenBalances(
  positions: Array<JuiceSwapPosition>,
  nativeExchangeRate?: string | null,
): Array<AddressTokenBalance & { usd?: BigNumber }> {
  return positions.map((pos) => {
    const rate0 = getEffectiveExchangeRate(pos.token0Address, null, nativeExchangeRate);
    const rate1 = getEffectiveExchangeRate(pos.token1Address, null, nativeExchangeRate);
    const decimals = 18;
    const usd0 = rate0 ? parseFloat(pos.amount0Wei) / (10 ** decimals) * parseFloat(rate0) : 0;
    const usd1 = rate1 ? parseFloat(pos.amount1Wei) / (10 ** decimals) * parseFloat(rate1) : 0;
    const totalUsd = usd0 + usd1;

    return {
      token: {
        address_hash: NFT_MANAGER,
        type: 'ERC-721' as const,
        symbol: `${ pos.token0Symbol } + ${ pos.token1Symbol }`,
        name: `JuiceSwap LP #${ pos.tokenId }`,
        decimals: '0',
        holders_count: null,
        exchange_rate: null,
        total_supply: null,
        icon_url: null,
        circulating_market_cap: null,
        reputation: null,
      },
      token_id: `lp-${ pos.tokenId }`,
      value: '1',
      token_instance: null,
      usd: totalUsd > 0 ? new BigNumber(totalUsd) : undefined,
    };
  });
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

function decodeString(hex: string): string {
  const raw = hex.slice(2);
  if (raw.length < 128) {
    return '';
  }
  const length = parseInt(raw.slice(64, 128), 16);
  const bytes = raw.slice(128, 128 + length * 2);
  let result = '';
  for (let i = 0; i < bytes.length; i += 2) {
    result += String.fromCharCode(parseInt(bytes.slice(i, i + 2), 16));
  }
  return result;
}

async function fetchSinglePosition(
  rpcUrl: string,
  tokenId: number,
): Promise<JuiceSwapPositionDetail> {
  // 1. positions(tokenId) -> 12 ABI-encoded fields
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

  const INT256_MAX = BigInt(1) << BigInt(255);
  const UINT256_RANGE = BigInt(1) << BigInt(256);
  const tickLowerRaw = BigInt('0x' + fields[5]);
  const tickLower = Number(tickLowerRaw >= INT256_MAX ? tickLowerRaw - UINT256_RANGE : tickLowerRaw);
  const tickUpperRaw = BigInt('0x' + fields[6]);
  const tickUpper = Number(tickUpperRaw >= INT256_MAX ? tickUpperRaw - UINT256_RANGE : tickUpperRaw);
  const liquidity = parseFloat(BigInt('0x' + fields[7]).toString());

  // 2. Fetch token metadata (symbol + decimals) in parallel
  const [ symbol0Result, symbol1Result, decimals0Result, decimals1Result ] = await Promise.all([
    rpcCall(rpcUrl, token0, SYMBOL_SELECTOR),
    rpcCall(rpcUrl, token1, SYMBOL_SELECTOR),
    rpcCall(rpcUrl, token0, DECIMALS_SELECTOR),
    rpcCall(rpcUrl, token1, DECIMALS_SELECTOR),
  ]);

  const token0Symbol = decodeString(symbol0Result) || 'Token0';
  const token1Symbol = decodeString(symbol1Result) || 'Token1';
  const token0Decimals = parseInt(decimals0Result, 16) || 18;
  const token1Decimals = parseInt(decimals1Result, 16) || 18;

  // 3. Get pool and slot0
  const poolResult = await rpcCall(
    rpcUrl, FACTORY,
    GET_POOL + padAddress(token0) + padAddress(token1) + padUint256(fee),
  );
  const poolAddr = '0x' + poolResult.slice(26);
  const slot0Result = await rpcCall(rpcUrl, poolAddr, SLOT0);
  const sqrtPriceX96 = Number(BigInt('0x' + slot0Result.slice(2, 66)));

  // 4. V3 math
  const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
  const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
  const sqrtPrice = sqrtPriceX96 / (2 ** 96);
  const currentTick = Math.log(sqrtPrice ** 2) / Math.log(1.0001);

  let amount0 = 0;
  let amount1 = 0;
  if (liquidity > 0) {
    if (currentTick <= tickLower) {
      amount0 = liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB));
    } else if (currentTick > tickUpper) {
      amount1 = liquidity * (sqrtRatioB - sqrtRatioA);
    } else {
      amount0 = liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB));
      amount1 = liquidity * (sqrtPrice - sqrtRatioA);
    }
  }

  const inRange = currentTick >= tickLower && currentTick <= tickUpper;

  return {
    tokenId,
    token0Address: token0,
    token1Address: token1,
    amount0Wei: BigInt(Math.round(amount0)).toString(),
    amount1Wei: BigInt(Math.round(amount1)).toString(),
    fee,
    tickLower,
    tickUpper,
    currentTick: Math.floor(currentTick),
    inRange,
    token0Decimals,
    token1Decimals,
    token0Symbol,
    token1Symbol,
    liquidity,
  };
}

export function useJuiceSwapPosition(tokenId?: string) {
  const rpcUrl = config.chain.rpcUrls?.[0];
  const numericId = tokenId ? parseInt(tokenId, 10) : NaN;

  return useQuery({
    queryKey: [ 'juiceswap-position', tokenId ],
    queryFn: () => fetchSinglePosition(rpcUrl ?? '', numericId),
    staleTime: STALE_TIME,
    refetchInterval: STALE_TIME,
    enabled: Boolean(rpcUrl) && !isNaN(numericId),
  });
}

export { NFT_MANAGER };
