import chain from 'configs/app/chain';

import { STABLECOIN_ADDRESSES, WRAPPED_NATIVE_ADDRESSES, VAULT_TOKEN_ADDRESSES } from './stablecoin-addresses.generated';

const STABLECOIN_PRICE = '1.00';
const VAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface VaultCacheEntry {
  pricePerShare: string;
  timestamp: number;
}

const vaultPriceCache = new Map<string, VaultCacheEntry>();

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

function getVaultTokenAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const addresses = VAULT_TOKEN_ADDRESSES[chainId];

  return new Set(addresses ?? []);
}

const stablecoinAddresses = getStablecoinAddressesForChain();
const wrappedNativeAddress = getWrappedNativeAddressForChain();
const vaultTokenAddresses = getVaultTokenAddressesForChain();

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

  // Vault tokens (e.g., svJUSD) use cached pricePerShare
  if (vaultTokenAddresses.has(normalizedAddress)) {
    const cachedPrice = getCachedVaultPrice(normalizedAddress);
    if (cachedPrice) {
      return cachedPrice;
    }
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

export function isVaultToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return vaultTokenAddresses.has(tokenAddress.toLowerCase());
}

export function getCachedVaultPrice(tokenAddress: string): string | null {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = vaultPriceCache.get(normalizedAddress);

  if (cached && Date.now() - cached.timestamp < VAULT_CACHE_TTL_MS) {
    return cached.pricePerShare;
  }

  return null;
}

export function setCachedVaultPrice(tokenAddress: string, pricePerShare: string): void {
  const normalizedAddress = tokenAddress.toLowerCase();
  vaultPriceCache.set(normalizedAddress, {
    pricePerShare,
    timestamp: Date.now(),
  });
}
