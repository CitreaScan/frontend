import { test, expect } from '@playwright/test';

const NFT_MANAGER = '0x3D3821D358f56395d4053954f98aec0E1F0fa568';

test.describe('LP Position Details on NFT Instance Page', () => {

  test('position #85 shows LP details with token amounts and USD values', async({ page }) => {
    await page.goto(`/token/${ NFT_MANAGER }/instance/85`);

    // Wait for LP data to load — the token pair + fee text appears after RPC calls complete
    const pairText = page.getByText(/\w+ \/ \w+ · [\d.]+%/);
    await expect(pairText).toBeVisible({ timeout: 30_000 });

    // Token amounts — match amount + symbol + USD in parens to avoid matching price range
    const token0Amount = page.getByText(/(?:[\d,]+\.\d+|[\d,]+\d)\s+svJUSD\s+\(/);
    await expect(token0Amount).toBeVisible({ timeout: 10_000 });

    const token1Amount = page.getByText(/(?:[\d,]+\.\d+|[\d,]+\d)\s+WCBTC\s+\(/);
    await expect(token1Amount).toBeVisible({ timeout: 10_000 });

    // Total value — dollar amount
    const totalValue = page.getByText('Total value', { exact: true });
    await expect(totalValue).toBeVisible({ timeout: 10_000 });

    // Price range — inverted: "X – Y svJUSD per WCBTC"
    const priceRange = page.getByText(/(?:[\d,]+\.\d+|[\d,]+\d)\s+–\s+(?:[\d,]+\.\d+|[\d,]+\d)\s+svJUSD per WCBTC/);
    await expect(priceRange).toBeVisible({ timeout: 10_000 });

    // Status — "In range" or "Out of range"
    const status = page.getByText(/In range|Out of range/);
    await expect(status).toBeVisible({ timeout: 10_000 });
  });

  test('position #86 shows no active liquidity', async({ page }) => {
    await page.goto(`/token/${ NFT_MANAGER }/instance/86`);

    // Wait for "LP Position" label to appear
    const lpLabel = page.getByText('LP Position', { exact: true });
    await expect(lpLabel).toBeVisible({ timeout: 30_000 });

    // Should show "No active liquidity" since this position has 0 liquidity
    const noLiquidity = page.getByText('No active liquidity');
    await expect(noLiquidity).toBeVisible({ timeout: 10_000 });
  });

});
