import chain from 'configs/app/chain';

import { STABLECOIN_ADDRESSES } from './stablecoin-addresses.generated';

const STABLECOIN_PRICE = '1.00';

function getStablecoinAddressesForChain(): Set<string> {
  const chainId = Number(chain.id);
  const addresses = STABLECOIN_ADDRESSES[chainId];

  return new Set(addresses ?? []);
}

const stablecoinAddresses = getStablecoinAddressesForChain();

export function getEffectiveExchangeRate(
  tokenAddress: string | undefined,
  apiExchangeRate: string | null | undefined,
): string | null {
  if (!tokenAddress) {
    return apiExchangeRate ?? null;
  }

  if (stablecoinAddresses.has(tokenAddress.toLowerCase())) {
    return STABLECOIN_PRICE;
  }

  return apiExchangeRate ?? null;
}

export function isStablecoin(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return stablecoinAddresses.has(tokenAddress.toLowerCase());
}
