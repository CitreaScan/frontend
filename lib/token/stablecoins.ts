import chain from 'configs/app/chain';

import {
  STABLECOIN_ADDRESSES,
  WRAPPED_NATIVE_ADDRESSES,
  VAULT_TOKEN_ADDRESSES,
  EQUITY_TOKEN_ADDRESSES,
  BTC_PEGGED_ADDRESSES,
  LP_POOL_PRICE_TOKENS,
} from './stablecoin-addresses.generated';

const STABLECOIN_PRICE = '1.00';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface PriceCacheEntry {
  price: string;
  timestamp: number;
}

const vaultPriceCache = new Map<string, PriceCacheEntry>();
const equityPriceCache = new Map<string, PriceCacheEntry>();
const lpPoolPriceCache = new Map<string, PriceCacheEntry>();

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

function getEquityTokenAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const addresses = EQUITY_TOKEN_ADDRESSES[chainId];

  return new Set(addresses ?? []);
}

function getBtcPeggedAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const addresses = BTC_PEGGED_ADDRESSES[chainId];

  return new Set(addresses ?? []);
}

function getLpPoolTokenAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const tokenConfigs = LP_POOL_PRICE_TOKENS[chainId];

  return new Set(tokenConfigs ? Object.keys(tokenConfigs) : []);
}

const stablecoinAddresses = getStablecoinAddressesForChain();
const wrappedNativeAddress = getWrappedNativeAddressForChain();
const vaultTokenAddresses = getVaultTokenAddressesForChain();
const equityTokenAddresses = getEquityTokenAddressesForChain();
const btcPeggedAddresses = getBtcPeggedAddressesForChain();
const lpPoolTokenAddresses = getLpPoolTokenAddressesForChain();

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

  // BTC-pegged tokens (e.g., syBTC) use native currency exchange rate
  if (btcPeggedAddresses.has(normalizedAddress)) {
    return nativeExchangeRate ?? apiExchangeRate ?? null;
  }

  // Vault tokens (e.g., svJUSD) use cached pricePerShare
  if (vaultTokenAddresses.has(normalizedAddress)) {
    const cachedPrice = getCachedVaultPrice(normalizedAddress);
    if (cachedPrice) {
      return cachedPrice;
    }
  }

  // Equity tokens (e.g., JUICE) use cached price from on-chain price() function
  if (equityTokenAddresses.has(normalizedAddress)) {
    const cachedPrice = getCachedEquityPrice(normalizedAddress);
    if (cachedPrice) {
      return cachedPrice;
    }
  }

  // LP pool tokens (e.g., TAPFREAK) use cached price from Uniswap V2 style pool reserves
  if (lpPoolTokenAddresses.has(normalizedAddress)) {
    const cachedPrice = getCachedLpPoolPrice(normalizedAddress);
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

export function isBtcPegged(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return btcPeggedAddresses.has(tokenAddress.toLowerCase());
}

export function getCachedVaultPrice(tokenAddress: string): string | null {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = vaultPriceCache.get(normalizedAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.price;
  }

  return null;
}

export function setCachedVaultPrice(tokenAddress: string, pricePerShare: string): void {
  const normalizedAddress = tokenAddress.toLowerCase();
  vaultPriceCache.set(normalizedAddress, {
    price: pricePerShare,
    timestamp: Date.now(),
  });
}

export function isEquityToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return equityTokenAddresses.has(tokenAddress.toLowerCase());
}

export function getCachedEquityPrice(tokenAddress: string): string | null {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = equityPriceCache.get(normalizedAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.price;
  }

  return null;
}

export function setCachedEquityPrice(tokenAddress: string, price: string): void {
  const normalizedAddress = tokenAddress.toLowerCase();
  equityPriceCache.set(normalizedAddress, {
    price,
    timestamp: Date.now(),
  });
}

export function isLpPoolToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return lpPoolTokenAddresses.has(tokenAddress.toLowerCase());
}

export function getCachedLpPoolPrice(tokenAddress: string): string | null {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = lpPoolPriceCache.get(normalizedAddress);

  // LP pool prices have shorter TTL (5 minutes) due to DEX volatility
  const LP_CACHE_TTL_MS = 5 * 60 * 1000;
  if (cached && Date.now() - cached.timestamp < LP_CACHE_TTL_MS) {
    return cached.price;
  }

  return null;
}

export function setCachedLpPoolPrice(tokenAddress: string, price: string): void {
  const normalizedAddress = tokenAddress.toLowerCase();
  lpPoolPriceCache.set(normalizedAddress, {
    price,
    timestamp: Date.now(),
  });
}
