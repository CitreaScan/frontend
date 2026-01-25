import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

import { VAULT_TOKEN_ADDRESSES } from './stablecoin-addresses.generated';
import { setCachedVaultPrice } from './stablecoins';

const VAULT_PRICE_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ERC-4626 function selectors
const TOTAL_ASSETS_SELECTOR = '0x01e1d114';
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd';

interface RpcResponse {
  result?: string;
  error?: { message: string };
}

async function fetchVaultPricePerShare(vaultAddress: string, rpcUrl: string): Promise<string> {
  const makeCall = async(data: string): Promise<bigint> => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [ { to: vaultAddress, data }, 'latest' ],
        id: 1,
      }),
    });
    const json = await response.json() as RpcResponse;
    if (json.error) {
      throw new Error(json.error.message);
    }
    return BigInt(json.result ?? '0');
  };

  const [ totalAssets, totalSupply ] = await Promise.all([
    makeCall(TOTAL_ASSETS_SELECTOR),
    makeCall(TOTAL_SUPPLY_SELECTOR),
  ]);

  if (totalSupply === BigInt(0)) {
    return '1.00';
  }

  // Calculate pricePerShare with 18 decimal precision
  const pricePerShare = (totalAssets * BigInt(10 ** 18)) / totalSupply;
  const priceAsNumber = Number(pricePerShare) / 10 ** 18;

  return priceAsNumber.toFixed(8);
}

async function fetchAllVaultPrices(rpcUrl: string): Promise<Record<string, string>> {
  const chainId = String(config.chain.id);
  const vaultAddresses = VAULT_TOKEN_ADDRESSES[chainId] ?? [];

  const prices: Record<string, string> = {};

  await Promise.all(
    vaultAddresses.map(async(address) => {
      try {
        const price = await fetchVaultPricePerShare(address, rpcUrl);
        prices[address.toLowerCase()] = price;
        setCachedVaultPrice(address, price);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to fetch vault price for ${ address }:`, error);
      }
    }),
  );

  return prices;
}

export function useVaultPrices() {
  const rpcUrl = config.chain.rpcUrls?.[0];

  return useQuery({
    queryKey: [ 'vault-prices', config.chain.id ],
    queryFn: () => fetchAllVaultPrices(rpcUrl ?? ''),
    staleTime: VAULT_PRICE_STALE_TIME,
    refetchInterval: VAULT_PRICE_STALE_TIME,
    enabled: Boolean(rpcUrl),
  });
}
