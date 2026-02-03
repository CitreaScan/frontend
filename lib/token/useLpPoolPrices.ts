import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

import { LP_POOL_PRICE_TOKENS } from './stablecoin-addresses.generated';
import { setCachedLpPoolPrice } from './stablecoins';

const LP_POOL_PRICE_STALE_TIME = 5 * 60 * 1000; // 5 minutes (more frequent due to DEX volatility)

// getReserves() function selector
const GET_RESERVES_SELECTOR = '0x0902f1ac';

interface RpcResponse {
  result?: string;
  error?: { message: string };
}

interface PoolConfig {
  pool: string;
  quoteTokenIndex: 0 | 1;
}

async function fetchLpPoolPrice(
  poolAddress: string,
  quoteTokenIndex: 0 | 1,
  rpcUrl: string,
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [ { to: poolAddress, data: GET_RESERVES_SELECTOR }, 'latest' ],
      id: 1,
    }),
  });

  const json = await response.json() as RpcResponse;

  if (json.error) {
    throw new Error(json.error.message);
  }

  const result = json.result ?? '0x';

  // getReserves() returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
  // Each uint112 is padded to 32 bytes (64 hex chars)
  const reserve0Hex = '0x' + result.slice(2, 66);
  const reserve1Hex = '0x' + result.slice(66, 130);

  const reserve0 = BigInt(reserve0Hex);
  const reserve1 = BigInt(reserve1Hex);

  if (reserve0 === BigInt(0) || reserve1 === BigInt(0)) {
    throw new Error('Pool has zero reserves');
  }

  // Calculate price based on which token is the quote token (stablecoin)
  // If quoteTokenIndex is 0, price = reserve0 / reserve1 (quote per token)
  // If quoteTokenIndex is 1, price = reserve1 / reserve0 (quote per token)
  let price: number;
  if (quoteTokenIndex === 0) {
    price = Number(reserve0) / Number(reserve1);
  } else {
    price = Number(reserve1) / Number(reserve0);
  }

  return price.toFixed(8);
}

async function fetchAllLpPoolPrices(rpcUrl: string): Promise<Record<string, string>> {
  const chainId = String(config.chain.id);
  const tokenConfigs = LP_POOL_PRICE_TOKENS[chainId] ?? {};

  const prices: Record<string, string> = {};

  await Promise.all(
    Object.entries(tokenConfigs).map(async([ tokenAddress, poolConfig ]: [ string, PoolConfig ]) => {
      try {
        const price = await fetchLpPoolPrice(poolConfig.pool, poolConfig.quoteTokenIndex, rpcUrl);
        const normalizedAddress = tokenAddress.toLowerCase();
        prices[normalizedAddress] = price;
        setCachedLpPoolPrice(tokenAddress, price);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch LP pool price for ${ tokenAddress }:`, error);
      }
    }),
  );

  return prices;
}

export function useLpPoolPrices() {
  const rpcUrl = config.chain.rpcUrls?.[0];

  return useQuery({
    queryKey: [ 'lp-pool-prices', config.chain.id ],
    queryFn: () => fetchAllLpPoolPrices(rpcUrl ?? ''),
    staleTime: LP_POOL_PRICE_STALE_TIME,
    refetchInterval: LP_POOL_PRICE_STALE_TIME,
    enabled: Boolean(rpcUrl),
  });
}
