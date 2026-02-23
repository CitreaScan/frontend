import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';

import type { AddressTokenBalance } from 'types/api/address';

import config from 'configs/app';
import { getEffectiveExchangeRate } from 'lib/token/stablecoins';

// JuiceSwap V3 contracts on Citrea
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

// Signed int256 decoding constants
const INT256_MAX = BigInt(1) << BigInt(255);
const UINT256_RANGE = BigInt(1) << BigInt(256);

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
  token0Decimals: number;
  token1Decimals: number;
}

export interface JuiceSwapPositionDetail extends JuiceSwapPosition {
  fee: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  inRange: boolean;
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

function decodeSignedInt256(hex: string): number {
  const raw = BigInt('0x' + hex);
  return Number(raw >= INT256_MAX ? raw - UINT256_RANGE : raw);
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

/**
 * Compute Uniswap V3 token amounts from position data.
 * Uses floating-point math which is sufficient for display purposes
 * but may lose precision for very large liquidity values (>2^53).
 */
function computeV3Amounts(
  liquidity: number,
  tickLower: number,
  tickUpper: number,
  sqrtPriceX96: number,
): { amount0: number; amount1: number; currentTick: number } {
  const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
  const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
  const sqrtPrice = sqrtPriceX96 / (2 ** 96);
  const currentTick = Math.log(sqrtPrice ** 2) / Math.log(1.0001);

  let amount0 = 0;
  let amount1 = 0;

  if (liquidity > 0) {
    if (currentTick < tickLower) {
      amount0 = liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB));
    } else if (currentTick > tickUpper) {
      amount1 = liquidity * (sqrtRatioB - sqrtRatioA);
    } else {
      amount0 = liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB));
      amount1 = liquidity * (sqrtPrice - sqrtRatioA);
    }
  }

  return { amount0, amount1, currentTick };
}

function parsePositionFields(posResult: string) {
  const raw = posResult.slice(2);
  const fields: Array<string> = [];
  for (let j = 0; j < 12; j++) {
    fields.push(raw.slice(j * 64, (j + 1) * 64));
  }
  return {
    token0: '0x' + fields[2].slice(24),
    token1: '0x' + fields[3].slice(24),
    fee: parseInt(fields[4], 16),
    tickLower: decodeSignedInt256(fields[5]),
    tickUpper: decodeSignedInt256(fields[6]),
    liquidity: parseFloat(BigInt('0x' + fields[7]).toString()),
  };
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

  const ownerPad = padAddress(address);

  // 2. Fetch all tokenIds in parallel
  const tokenIdResults = await Promise.all(
    Array.from({ length: nftCount }, (_, i) =>
      rpcCall(rpcUrl, NFT_MANAGER, TOKEN_OF_OWNER_BY_INDEX + ownerPad + padUint256(i)),
    ),
  );
  const tokenIds = tokenIdResults.map(r => parseInt(r, 16));

  // 3. Fetch all positions in parallel
  const posResults = await Promise.all(
    tokenIds.map(id =>
      rpcCall(rpcUrl, NFT_MANAGER, POSITIONS_SELECTOR + padUint256(id)),
    ),
  );

  // 4. Parse position fields
  const parsed = posResults.map(parsePositionFields);

  // 5. Fetch all unique token metadata (symbol + decimals) in parallel
  const uniqueTokens = [ ...new Set(parsed.flatMap(p => [ p.token0, p.token1 ])) ];
  const metadataResults = await Promise.all(
    uniqueTokens.flatMap(token => [
      rpcCall(rpcUrl, token, SYMBOL_SELECTOR),
      rpcCall(rpcUrl, token, DECIMALS_SELECTOR),
    ]),
  );
  const tokenMeta: Record<string, { symbol: string; decimals: number }> = {};
  for (let i = 0; i < uniqueTokens.length; i++) {
    tokenMeta[uniqueTokens[i]] = {
      symbol: decodeString(metadataResults[i * 2]) || uniqueTokens[i].slice(0, 10),
      decimals: parseInt(metadataResults[i * 2 + 1], 16) || 18,
    };
  }

  // 6. Fetch pool data only for positions with liquidity (batch unique pools)
  const poolCache: Record<string, bigint> = {};
  const poolsToFetch: Array<{ key: string; token0: string; token1: string; fee: number }> = [];
  for (const pos of parsed) {
    if (pos.liquidity > 0) {
      const key = `${ pos.token0 }-${ pos.token1 }-${ pos.fee }`;
      if (!poolCache[key] && !poolsToFetch.some(p => p.key === key)) {
        poolsToFetch.push({ key, token0: pos.token0, token1: pos.token1, fee: pos.fee });
      }
    }
  }

  if (poolsToFetch.length > 0) {
    const poolAddrResults = await Promise.all(
      poolsToFetch.map(p =>
        rpcCall(rpcUrl, FACTORY, GET_POOL + padAddress(p.token0) + padAddress(p.token1) + padUint256(p.fee)),
      ),
    );
    const poolAddrs = poolAddrResults.map(r => '0x' + r.slice(26));

    const slot0Results = await Promise.all(
      poolAddrs.map(addr => rpcCall(rpcUrl, addr, SLOT0)),
    );
    for (let i = 0; i < poolsToFetch.length; i++) {
      poolCache[poolsToFetch[i].key] = BigInt('0x' + slot0Results[i].slice(2, 66));
    }
  }

  // 7. Compute amounts
  return parsed.map((pos, i) => {
    const poolKey = `${ pos.token0 }-${ pos.token1 }-${ pos.fee }`;
    const { amount0, amount1 } = pos.liquidity > 0 && poolCache[poolKey] ?
      computeV3Amounts(pos.liquidity, pos.tickLower, pos.tickUpper, Number(poolCache[poolKey])) :
      { amount0: 0, amount1: 0 };

    return {
      tokenId: tokenIds[i],
      token0Address: pos.token0,
      token1Address: pos.token1,
      amount0Wei: BigInt(Math.round(amount0)).toString(),
      amount1Wei: BigInt(Math.round(amount1)).toString(),
      token0Symbol: tokenMeta[pos.token0].symbol,
      token1Symbol: tokenMeta[pos.token1].symbol,
      token0Decimals: tokenMeta[pos.token0].decimals,
      token1Decimals: tokenMeta[pos.token1].decimals,
    };
  });
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
    const usd0 = rate0 ? parseFloat(pos.amount0Wei) / (10 ** pos.token0Decimals) * parseFloat(rate0) : 0;
    const usd1 = rate1 ? parseFloat(pos.amount1Wei) / (10 ** pos.token1Decimals) * parseFloat(rate1) : 0;
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

async function fetchSinglePosition(
  rpcUrl: string,
  tokenId: number,
): Promise<JuiceSwapPositionDetail> {
  const posResult = await rpcCall(
    rpcUrl, NFT_MANAGER,
    POSITIONS_SELECTOR + padUint256(tokenId),
  );
  const { token0, token1, fee, tickLower, tickUpper, liquidity } = parsePositionFields(posResult);

  // Fetch token metadata (symbol + decimals) in parallel
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

  // Only fetch pool data if position has liquidity
  let sqrtPriceX96Num = 0;
  if (liquidity > 0) {
    const poolResult = await rpcCall(
      rpcUrl, FACTORY,
      GET_POOL + padAddress(token0) + padAddress(token1) + padUint256(fee),
    );
    const poolAddr = '0x' + poolResult.slice(26);
    const slot0Result = await rpcCall(rpcUrl, poolAddr, SLOT0);
    sqrtPriceX96Num = Number(BigInt('0x' + slot0Result.slice(2, 66)));
  }

  const { amount0, amount1, currentTick } = computeV3Amounts(liquidity, tickLower, tickUpper, sqrtPriceX96Num);
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
