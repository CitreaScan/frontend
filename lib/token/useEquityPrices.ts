import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

import { EQUITY_TOKEN_ADDRESSES } from './stablecoin-addresses.generated';
import { setCachedEquityPrice } from './stablecoins';

const EQUITY_PRICE_STALE_TIME = 60 * 60 * 1000; // 1 hour

// price() function selector
const PRICE_SELECTOR = '0xa035b1fe';

interface RpcResponse {
  result?: string;
  error?: { message: string };
}

async function fetchEquityTokenPrice(tokenAddress: string, rpcUrl: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [ { to: tokenAddress, data: PRICE_SELECTOR }, 'latest' ],
      id: 1,
    }),
  });

  const json = await response.json() as RpcResponse;

  if (json.error) {
    throw new Error(json.error.message);
  }

  const priceRaw = BigInt(json.result ?? '0');

  // Price is returned with 18 decimals
  const priceAsNumber = Number(priceRaw) / 10 ** 18;

  return priceAsNumber.toFixed(8);
}

async function fetchAllEquityPrices(rpcUrl: string): Promise<Record<string, string>> {
  const chainId = String(config.chain.id);
  const tokenAddresses = EQUITY_TOKEN_ADDRESSES[chainId] ?? [];

  const prices: Record<string, string> = {};

  await Promise.all(
    tokenAddresses.map(async(address) => {
      try {
        const price = await fetchEquityTokenPrice(address, rpcUrl);
        prices[address.toLowerCase()] = price;
        setCachedEquityPrice(address, price);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch equity price for ${ address }:`, error);
      }
    }),
  );

  return prices;
}

export function useEquityPrices() {
  const rpcUrl = config.chain.rpcUrls?.[0];

  return useQuery({
    queryKey: [ 'equity-prices', config.chain.id ],
    queryFn: () => fetchAllEquityPrices(rpcUrl ?? ''),
    staleTime: EQUITY_PRICE_STALE_TIME,
    refetchInterval: EQUITY_PRICE_STALE_TIME,
    enabled: Boolean(rpcUrl),
  });
}
