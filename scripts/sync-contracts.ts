#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * Contract Verification Sync Script
 * Syncs verified contracts from explorer.testnet.citrea.xyz to dev.testnet.citreascan.com
 */

const SOURCE_EXPLORER = 'https://explorer.testnet.citrea.xyz/api/v2';
const TARGET_EXPLORER = 'https://dev.testnet.citreascan.com/api/v2';
const DELAY_MS = 2000;
const VERIFICATION_TIMEOUT_MS = 60000;

interface Contract {
  address: { hash: string } | string;
  compiler_version: string;
  optimization_enabled?: boolean;
  verified_at?: string;
}

interface ContractDetails {
  source_code: string;
  compiler_version: string;
  optimization_runs?: number | string;
  evm_version?: string;
  constructor_args?: string | null;
  has_constructor_args?: boolean;
  license_type?: string;
  file_path: string;
  is_verified?: boolean;
  additional_sources?: Array<{ file_path: string; source_code: string }>;
}

interface VerifiedContractsResponse {
  items: Array<Contract>;
  next_page_params?: Record<string, string | number>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractContractName(filePath: string): string {
  const match = filePath.match(/\/([^/]+)\.sol$/);
  if (match) return match[1];
  return filePath.replace('.sol', '').replace(/^.*\//, '');
}

function getAddress(contract: Contract): string {
  return typeof contract.address === 'string' ?
    contract.address :
    contract.address.hash;
}

async function fetchAllVerifiedContracts(): Promise<Array<string>> {
  console.log('Fetching verified contracts from source explorer...');

  const addresses: Array<string> = [];
  let url = `${ SOURCE_EXPLORER }/smart-contracts?filter=verified`;

  while (url) {
    try {
      const response = await fetch(url);
      const data: VerifiedContractsResponse = await response.json();

      const newAddresses = data.items.map(getAddress);
      addresses.push(...newAddresses);

      if (data.next_page_params) {
        const params = new URLSearchParams(
          Object.entries(data.next_page_params).map(([ k, v ]) => [ k, String(v) ]),
        );
        url = `${ SOURCE_EXPLORER }/smart-contracts?filter=verified&${ params }`;
      } else {
        url = '';
      }

      await delay(500);
    } catch (error) {
      console.error('Error fetching contracts list:', error);
      break;
    }
  }

  return addresses;
}

async function fetchContractDetails(address: string): Promise<ContractDetails | null> {
  try {
    const response = await fetch(`${ SOURCE_EXPLORER }/smart-contracts/${ address }`);
    if (!response.ok) {
      console.error(`  Failed to fetch details (${ response.status })`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('  Error fetching contract details:', error);
    return null;
  }
}

async function isAlreadyVerified(address: string): Promise<boolean> {
  try {
    const response = await fetch(`${ TARGET_EXPLORER }/smart-contracts/${ address }`);
    if (!response.ok) return false;

    const data: ContractDetails = await response.json();
    return data.is_verified || false;
  } catch (error) {
    return false;
  }
}

async function verifyContract(address: string, details: ContractDetails): Promise<boolean> {
  try {
    const verificationData = {
      compiler_version: details.compiler_version,
      source_code: details.source_code,
      is_optimization_enabled: details.optimization_runs ? true : false,
      optimization_runs: String(details.optimization_runs || '200'),
      contract_name: extractContractName(details.file_path),
      evm_version: details.evm_version || 'paris',
      license_type: details.license_type || 'none',
      constructor_args: details.constructor_args || '',
      autodetect_constructor_args: !details.has_constructor_args,
    };

    const response = await fetch(
      `${ TARGET_EXPLORER }/smart-contracts/${ address }/verification/via/flattened-code`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  Verification failed (${ response.status }):`, errorText.substring(0, 200));
      return false;
    }

    console.log('  Waiting for verification to complete...');
    const maxAttempts = Math.floor(VERIFICATION_TIMEOUT_MS / 3000);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await delay(3000);

      const checkResponse = await fetch(`${ TARGET_EXPLORER }/smart-contracts/${ address }`);
      if (checkResponse.ok) {
        const checkData: ContractDetails = await checkResponse.json();
        if (checkData.is_verified) {
          return true;
        }
      }

      if (attempt < maxAttempts - 1) {
        process.stdout.write('.');
      }
    }

    console.log('\n  Verification timed out (contract may still be processing)');
    return false;
  } catch (error) {
    console.error('  Error during verification:', error);
    return false;
  }
}

async function syncContracts() {
  console.log('\nStarting Contract Verification Sync\n');
  console.log(`Source: ${ SOURCE_EXPLORER }`);
  console.log(`Target: ${ TARGET_EXPLORER }\n`);

  const addresses = await fetchAllVerifiedContracts();
  console.log(`Found ${ addresses.length } verified contracts\n`);

  if (addresses.length === 0) {
    console.log('No verified contracts found. Exiting.');
    return;
  }

  let verified = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const progress = `[${ i + 1 }/${ addresses.length }]`;

    console.log(`${ progress } Processing ${ address }...`);

    if (await isAlreadyVerified(address)) {
      console.log('  Already verified, skipping\n');
      skipped++;
      continue;
    }

    const details = await fetchContractDetails(address);
    if (!details || !details.source_code) {
      console.log('  Could not fetch contract details, skipping\n');
      failed++;
      continue;
    }

    const success = await verifyContract(address, details);
    if (success) {
      console.log('  Verified successfully\n');
      verified++;
    } else {
      console.log('  Verification failed, skipping\n');
      failed++;
    }

    await delay(DELAY_MS);
  }

  console.log('─'.repeat(50));
  console.log('\nSync Complete\n');
  console.log(`Summary:`);
  console.log(`  Newly verified: ${ verified }`);
  console.log(`  Already verified: ${ skipped }`);
  console.log(`  Failed: ${ failed }`);
  console.log(`  Total processed: ${ addresses.length }\n`);
}

if (import.meta.url === `file://${ process.argv[1] }`) {
  syncContracts().catch(console.error);
}

export { syncContracts };
