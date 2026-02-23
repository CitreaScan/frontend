import { test, expect } from '@playwright/test';

const ADDRESS = '0xB2CBBde7cfDb5ea1DB27aCcdd1abf7EE3BcC87C1';
const NFT_MANAGER = '0x3D3821D358f56395d4053954f98aec0E1F0fa568';

test.describe('JuiceSwap LP Balances', () => {

  test('address overview shows LP value in net worth', async({ page }) => {
    await page.goto(`/address/${ ADDRESS }`);

    // Wait for page to load
    const netWorthLabel = page.getByText('Net worth', { exact: true });
    await expect(netWorthLabel).toBeVisible({ timeout: 30_000 });

    // Wait for LP data to load (RPC calls take time)
    await page.waitForTimeout(12_000);

    // The net worth value is in a grid. Get text from the broader area
    // and extract the dollar amount that follows "Net worth"
    const gridRow = netWorthLabel.locator('..').locator('..').locator('..');
    const fullText = await gridRow.textContent();

    // Extract dollar amount specifically after "Net worth"
    const match = fullText?.match(/Net worth\$([\d,]+\.?\d*)/);
    expect(match).toBeTruthy();
    const netWorth = parseFloat(match![1].replace(/,/g, ''));

    // With LP positions (~$164k), net worth should be well above regular tokens (~$249k)
    expect(netWorth).toBeGreaterThan(300_000);
  });

  test('tokens dropdown shows one item per LP position with USD value', async({ page }) => {
    await page.goto(`/address/${ ADDRESS }`);

    // Wait for LP data to load
    await page.waitForTimeout(12_000);

    // Click the token select dropdown button
    const tokenButton = page.locator('[aria-label="Token select"]');
    await expect(tokenButton).toBeVisible({ timeout: 30_000 });
    await tokenButton.click();

    // Wait for the opened popover
    const dropdown = page.locator('[role="dialog"][data-state="open"]');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Each LP position should appear as one item (not two per token)
    const lpItems = dropdown.getByText(/JuiceSwap LP #/);
    const lpCount = await lpItems.count();
    expect(lpCount).toBeGreaterThanOrEqual(2);

    // Verify LP items have dollar values and link to instance page
    const allLinks = dropdown.locator('a');
    const linkCount = await allLinks.count();
    let lpLinksWithValue = 0;
    let lpLinksToInstance = 0;

    for (let i = 0; i < linkCount; i++) {
      const text = await allLinks.nth(i).textContent();
      if (text?.includes('JuiceSwap LP')) {
        if (text.match(/\$[\d,]+\.?\d*/)) {
          lpLinksWithValue++;
        }
        const href = await allLinks.nth(i).getAttribute('href');
        if (href?.includes(`/token/${ NFT_MANAGER }/instance/`)) {
          lpLinksToInstance++;
        }
      }
    }

    expect(lpLinksWithValue).toBeGreaterThanOrEqual(2);
    expect(lpLinksToInstance).toBeGreaterThanOrEqual(2);
  });

});
