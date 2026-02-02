import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

import { BONDING_CURVE_TOKENS } from './stablecoin-addresses.generated';
import { setCachedBondingCurvePrice } from './stablecoins';

const BONDING_CURVE_PRICE_STALE_TIME = 5 * 60 * 1000; // 5 minutes (prices change with buys/sells)

// Function selectors for bonding curve contract
// virtualBaseReserves() - returns the virtual BTC reserve
const VIRTUAL_BASE_RESERVES_SELECTOR = '0xae43509a';
// virtualTokenReserves() - returns the virtual token reserve
const VIRTUAL_TOKEN_RESERVES_SELECTOR = '0x1655bc62';

interface RpcResponse {
  result?: string;
  error?: { message: string };
}

async function fetchBondingCurvePrice(
  tokenAddress: string,
  rpcUrl: string,
): Promise<string> {
  // Fetch both reserves in parallel
  const [ baseResponse, tokenResponse ] = await Promise.all([
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [ { to: tokenAddress, data: VIRTUAL_BASE_RESERVES_SELECTOR }, 'latest' ],
        id: 1,
      }),
    }),
    fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [ { to: tokenAddress, data: VIRTUAL_TOKEN_RESERVES_SELECTOR }, 'latest' ],
        id: 2,
      }),
    }),
  ]);

  const baseJson = await baseResponse.json() as RpcResponse;
  const tokenJson = await tokenResponse.json() as RpcResponse;

  if (baseJson.error) {
    throw new Error(`virtualBaseReserves error: ${ baseJson.error.message }`);
  }

  if (tokenJson.error) {
    throw new Error(`virtualTokenReserves error: ${ tokenJson.error.message }`);
  }

  const virtualBaseReserves = BigInt(baseJson.result ?? '0');
  const virtualTokenReserves = BigInt(tokenJson.result ?? '0');

  if (virtualTokenReserves === BigInt(0)) {
    throw new Error('Virtual token reserves is zero');
  }

  // Price in USD = virtualBaseReserves / virtualTokenReserves
  // The base token is a stablecoin (JUSD = $1), so the ratio gives us USD per token
  // Both values are in 18 decimals, so they cancel out
  const priceInUsd = Number(virtualBaseReserves) / Number(virtualTokenReserves);

  return priceInUsd.toFixed(8);
}

async function fetchAllBondingCurvePrices(
  rpcUrl: string,
): Promise<Record<string, string>> {
  const chainId = String(config.chain.id);
  const tokenAddresses = BONDING_CURVE_TOKENS[chainId] ?? [];

  const prices: Record<string, string> = {};

  await Promise.all(
    tokenAddresses.map(async(address) => {
      try {
        const price = await fetchBondingCurvePrice(address, rpcUrl);
        const normalizedAddress = address.toLowerCase();
        prices[normalizedAddress] = price;
        setCachedBondingCurvePrice(address, price);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch bonding curve price for ${ address }:`, error);
      }
    }),
  );

  return prices;
}

export function useBondingCurvePrices() {
  const rpcUrl = config.chain.rpcUrls?.[0];

  return useQuery({
    queryKey: [ 'bonding-curve-prices', config.chain.id ],
    queryFn: () => fetchAllBondingCurvePrices(rpcUrl ?? ''),
    staleTime: BONDING_CURVE_PRICE_STALE_TIME,
    refetchInterval: BONDING_CURVE_PRICE_STALE_TIME,
    enabled: Boolean(rpcUrl),
  });
}
