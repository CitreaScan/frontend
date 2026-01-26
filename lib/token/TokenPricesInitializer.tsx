import { useEquityPrices } from './useEquityPrices';
import { useVaultPrices } from './useVaultPrices';

/**
 * Global initializer component that fetches and caches token prices.
 * This ensures vault tokens (e.g., svJUSD) and equity tokens (e.g., JUICE)
 * have their prices available on all pages, not just the address page.
 *
 * Must be rendered inside QueryClientProvider.
 */
export function TokenPricesInitializer() {
  useVaultPrices();
  useEquityPrices();

  return null;
}
