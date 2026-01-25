// Stablecoins with fixed USD prices
// These tokens will always display the configured price instead of the API exchange_rate
const STABLECOIN_PRICES: Record<string, string> = {
  '0x6a850a548fdd050e8961223ec8FfCDfacEa57E39': '1.00',
};

export function getEffectiveExchangeRate(
  tokenAddress: string | undefined,
  apiExchangeRate: string | null | undefined,
): string | null {
  if (!tokenAddress) {
    return apiExchangeRate ?? null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();

  for (const [ address, fixedPrice ] of Object.entries(STABLECOIN_PRICES)) {
    if (address.toLowerCase() === normalizedAddress) {
      return fixedPrice;
    }
  }

  return apiExchangeRate ?? null;
}

export function isStablecoin(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  const normalizedAddress = tokenAddress.toLowerCase();

  return Object.keys(STABLECOIN_PRICES).some(
    (address) => address.toLowerCase() === normalizedAddress,
  );
}
