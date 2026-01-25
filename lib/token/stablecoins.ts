import chain from 'configs/app/chain';

import { STABLECOIN_ADDRESSES, WRAPPED_NATIVE_ADDRESSES } from './stablecoin-addresses.generated';

const STABLECOIN_PRICE = '1.00';

function getStablecoinAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const addresses = STABLECOIN_ADDRESSES[chainId];

  return new Set(addresses ?? []);
}

function getWrappedNativeAddressForChain(): string | undefined {
  const chainId = String(chain.id);
  const address = WRAPPED_NATIVE_ADDRESSES[chainId];

  return address?.toLowerCase();
}

const stablecoinAddresses = getStablecoinAddressesForChain();
const wrappedNativeAddress = getWrappedNativeAddressForChain();

export function getEffectiveExchangeRate(
  tokenAddress: string | undefined,
  apiExchangeRate: string | null | undefined,
  nativeExchangeRate?: string | null,
): string | null {
  if (!tokenAddress) {
    return apiExchangeRate ?? null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();

  // Stablecoins use fixed price of $1.00
  if (stablecoinAddresses.has(normalizedAddress)) {
    return STABLECOIN_PRICE;
  }

  // Wrapped native tokens (e.g., WcBTC) use native currency exchange rate
  if (wrappedNativeAddress && normalizedAddress === wrappedNativeAddress) {
    return nativeExchangeRate ?? apiExchangeRate ?? null;
  }

  return apiExchangeRate ?? null;
}

export function isStablecoin(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return stablecoinAddresses.has(tokenAddress.toLowerCase());
}

export function isWrappedNative(tokenAddress: string | undefined): boolean {
  if (!tokenAddress || !wrappedNativeAddress) {
    return false;
  }

  return tokenAddress.toLowerCase() === wrappedNativeAddress;
}
