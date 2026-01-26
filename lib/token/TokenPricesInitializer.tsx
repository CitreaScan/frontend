import { useEquityPrices } from './useEquityPrices';
import { useVaultPrices } from './useVaultPrices';

/**
 * Hook that fetches and caches vault/equity token prices.
 * Components using this hook will re-render when prices are loaded,
 * ensuring getCurrencyValue() has access to the cached prices.
 *
 * Returns a version number that changes when prices are loaded,
 * which can be used as a dependency for memoization.
 */
export function useTokenPrices() {
  const { data: vaultPrices } = useVaultPrices();
  const { data: equityPrices } = useEquityPrices();

  // Version changes when prices load, triggering re-renders
  const version = (vaultPrices ? Object.keys(vaultPrices).length : 0) +
    (equityPrices ? Object.keys(equityPrices).length : 0);

  return { version };
}

/**
 * Global initializer component that fetches and caches token prices.
 * This ensures vault tokens (e.g., svJUSD) and equity tokens (e.g., JUICE)
 * have their prices available on all pages, not just the address page.
 *
 * Must be rendered inside QueryClientProvider.
 */
export function TokenPricesInitializer() {
  useTokenPrices();

  return null;
}
