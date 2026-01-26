#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * This script extracts stablecoin addresses from @juicedollar/jusd package
 * and wrapped native token addresses from @juiceswapxyz/sdk-core package,
 * then generates a TypeScript file with the addresses.
 *
 * Used by GitHub Action to keep addresses in sync automatically.
 *
 * Usage: node scripts/sync-stablecoin-addresses.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../lib/token/stablecoin-addresses.generated.ts');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Only extract addresses for Citrea chains
const SUPPORTED_CHAIN_IDS = [ '4114', '5115' ]; // Citrea Mainnet, Citrea Testnet

// Stablecoin token keys to extract
const STABLECOIN_KEYS = [ 'juiceDollar', 'startUSD', 'USDC', 'USDT', 'CTUSD' ];

// Vault token keys to extract (ERC-4626 vaults with stablecoin underlying)
const VAULT_TOKEN_KEYS = [ 'savingsVaultJUSD' ];

// Equity token keys to extract (tokens with built-in price() function)
const EQUITY_TOKEN_KEYS = [ 'equity' ];

function extractStablecoinAddresses() {
  let ADDRESS;
  try {
    const jusd = require('@juicedollar/jusd');
    ADDRESS = jusd.ADDRESS;
  } catch (error) {
    console.error('Error: @juicedollar/jusd package not found.');
    console.error('Install it first: npm install @juicedollar/jusd');
    process.exit(1);
  }

  const result = {};

  for (const [ chainId, addresses ] of Object.entries(ADDRESS)) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) continue;

    const stablecoins = [];

    for (const key of STABLECOIN_KEYS) {
      const addr = addresses[key];
      if (addr && addr !== ZERO_ADDRESS) {
        stablecoins.push(addr.toLowerCase());
      }
    }

    if (stablecoins.length > 0) {
      result[chainId] = stablecoins;
    }
  }

  return result;
}

function extractVaultTokenAddresses() {
  let ADDRESS;
  try {
    const jusd = require('@juicedollar/jusd');
    ADDRESS = jusd.ADDRESS;
  } catch (error) {
    console.error('Error: @juicedollar/jusd package not found.');
    process.exit(1);
  }

  const result = {};

  for (const [ chainId, addresses ] of Object.entries(ADDRESS)) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) continue;

    const vaultTokens = [];

    for (const key of VAULT_TOKEN_KEYS) {
      const addr = addresses[key];
      if (addr && addr !== ZERO_ADDRESS) {
        vaultTokens.push(addr.toLowerCase());
      }
    }

    if (vaultTokens.length > 0) {
      result[chainId] = vaultTokens;
    }
  }

  return result;
}

function extractEquityTokenAddresses() {
  let ADDRESS;
  try {
    const jusd = require('@juicedollar/jusd');
    ADDRESS = jusd.ADDRESS;
  } catch (error) {
    console.error('Error: @juicedollar/jusd package not found.');
    process.exit(1);
  }

  const result = {};

  for (const [ chainId, addresses ] of Object.entries(ADDRESS)) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) continue;

    const equityTokens = [];

    for (const key of EQUITY_TOKEN_KEYS) {
      const addr = addresses[key];
      if (addr && addr !== ZERO_ADDRESS) {
        equityTokens.push(addr.toLowerCase());
      }
    }

    if (equityTokens.length > 0) {
      result[chainId] = equityTokens;
    }
  }

  return result;
}

function extractWrappedNativeAddresses() {
  let WETH9;
  try {
    const sdkCore = require('@juiceswapxyz/sdk-core');
    WETH9 = sdkCore.WETH9;
  } catch (error) {
    console.error('Error: @juiceswapxyz/sdk-core package not found.');
    console.error('Install it first: npm install @juiceswapxyz/sdk-core');
    process.exit(1);
  }

  const result = {};

  for (const [ chainId, token ] of Object.entries(WETH9)) {
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) continue;

    if (token && token.address && token.address !== ZERO_ADDRESS) {
      result[chainId] = token.address.toLowerCase();
    }
  }

  return result;
}

function generateTypeScript(stablecoinAddresses, wrappedNativeAddresses, vaultTokenAddresses, equityTokenAddresses) {
  const timestamp = new Date().toISOString();

  // Format stablecoin addresses object with proper indentation and single quotes
  const formattedStablecoins = Object.entries(stablecoinAddresses)
    .map(([ chainId, addrs ]) => {
      const addrLines = addrs.map((addr) => `    '${ addr }',`).join('\n');
      return `  '${ chainId }': [\n${ addrLines }\n  ],`;
    })
    .join('\n');

  // Format wrapped native addresses object
  const formattedWrappedNative = Object.entries(wrappedNativeAddresses)
    .map(([ chainId, addr ]) => `  '${ chainId }': '${ addr }',`)
    .join('\n');

  // Format vault token addresses object
  const formattedVaultTokens = Object.entries(vaultTokenAddresses)
    .map(([ chainId, addrs ]) => {
      const addrLines = addrs.map((addr) => `    '${ addr }',`).join('\n');
      return `  '${ chainId }': [\n${ addrLines }\n  ],`;
    })
    .join('\n');

  // Format equity token addresses object
  const formattedEquityTokens = Object.entries(equityTokenAddresses)
    .map(([ chainId, addrs ]) => {
      const addrLines = addrs.map((addr) => `    '${ addr }',`).join('\n');
      return `  '${ chainId }': [\n${ addrLines }\n  ],`;
    })
    .join('\n');

  return `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated by: scripts/sync-stablecoin-addresses.js
// Last updated: ${ timestamp }
// Source: @juicedollar/jusd and @juiceswapxyz/sdk-core packages

/**
 * Stablecoin addresses by chain ID.
 * These tokens will display a fixed price of $1.00.
 */
export const STABLECOIN_ADDRESSES: Record<string, ReadonlyArray<string>> = {
${ formattedStablecoins }
};

/**
 * Wrapped native token addresses by chain ID (e.g., WcBTC on Citrea).
 * These tokens will use the native currency exchange rate.
 */
export const WRAPPED_NATIVE_ADDRESSES: Record<string, string> = {
${ formattedWrappedNative }
};

/**
 * ERC-4626 Vault token addresses by chain ID.
 * These tokens use pricePerShare from on-chain data (totalAssets/totalSupply).
 * The underlying asset is assumed to be a stablecoin worth $1.00.
 */
export const VAULT_TOKEN_ADDRESSES: Record<string, ReadonlyArray<string>> = {
${ formattedVaultTokens }
};

/**
 * Equity token addresses by chain ID (e.g., JUICE).
 * These tokens have a built-in price() function that returns the current price.
 */
export const EQUITY_TOKEN_ADDRESSES: Record<string, ReadonlyArray<string>> = {
${ formattedEquityTokens }
};
`;
}

function main() {
  console.log('Extracting stablecoin addresses from @juicedollar/jusd...');
  const stablecoinAddresses = extractStablecoinAddresses();

  console.log('Extracting wrapped native addresses from @juiceswapxyz/sdk-core...');
  const wrappedNativeAddresses = extractWrappedNativeAddresses();

  console.log('Extracting vault token addresses from @juicedollar/jusd...');
  const vaultTokenAddresses = extractVaultTokenAddresses();

  console.log('Extracting equity token addresses from @juicedollar/jusd...');
  const equityTokenAddresses = extractEquityTokenAddresses();

  const content = generateTypeScript(stablecoinAddresses, wrappedNativeAddresses, vaultTokenAddresses, equityTokenAddresses);

  // Check if file exists and content is different
  let hasChanges = true;
  if (fs.existsSync(OUTPUT_FILE)) {
    const existingContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    // Compare without timestamp line
    const normalize = (s) => s.replace(/Last updated:.*\n/, '');
    hasChanges = normalize(existingContent) !== normalize(content);
  }

  if (hasChanges) {
    fs.writeFileSync(OUTPUT_FILE, content);
    console.log(`Updated: ${ OUTPUT_FILE }`);
    console.log('Stablecoin addresses:', JSON.stringify(stablecoinAddresses, null, 2));
    console.log('Wrapped native addresses:', JSON.stringify(wrappedNativeAddresses, null, 2));
    console.log('Vault token addresses:', JSON.stringify(vaultTokenAddresses, null, 2));
    console.log('Equity token addresses:', JSON.stringify(equityTokenAddresses, null, 2));
    process.exit(0);
  } else {
    console.log('No changes detected.');
    process.exit(0);
  }
}

main();
