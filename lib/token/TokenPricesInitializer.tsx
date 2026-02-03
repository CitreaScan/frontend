import { useBondingCurvePrices } from './useBondingCurvePrices';
import { useEquityPrices } from './useEquityPrices';
import { useLpPoolPrices } from './useLpPoolPrices';
import { useVaultPrices } from './useVaultPrices';

/**
 * Hook that fetches and caches vault/equity/LP pool/bonding curve token prices.
 * Components using this hook will re-render when prices are loaded,
 * ensuring getCurrencyValue() has access to the cached prices.
 *
 * Returns a version number that changes when prices are loaded,
 * which can be used as a dependency for memoization.
 */
export function useTokenPrices() {
  const { data: vaultPrices } = useVaultPrices();
  const { data: equityPrices } = useEquityPrices();
  const { data: lpPoolPrices } = useLpPoolPrices();
  const { data: bondingCurvePrices } = useBondingCurvePrices();

  // Version changes when prices load, triggering re-renders
  const version = (vaultPrices ? Object.keys(vaultPrices).length : 0) +
    (equityPrices ? Object.keys(equityPrices).length : 0) +
    (lpPoolPrices ? Object.keys(lpPoolPrices).length : 0) +
    (bondingCurvePrices ? Object.keys(bondingCurvePrices).length : 0);

  return { version };
}

/**
 * Global initializer component that fetches and caches token prices.
 * This ensures vault tokens (e.g., svJUSD), equity tokens (e.g., JUICE),
 * LP pool tokens (e.g., TAPFREAK), and bonding curve tokens (e.g., THERESIA)
 * have their prices available on all pages.
 *
 * Must be rendered inside QueryClientProvider.
 */
export function TokenPricesInitializer() {
  useTokenPrices();

  return null;
}
