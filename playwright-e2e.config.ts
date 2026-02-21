import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'http://localhost:3001',
    ...devices['Desktop Chrome'],
  },
});
