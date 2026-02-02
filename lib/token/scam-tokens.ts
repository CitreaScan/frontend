import chain from 'configs/app/chain';

/**
 * Known scam/fake token addresses by chain ID.
 * These tokens impersonate legitimate tokens and should display a warning.
 */
const SCAM_TOKEN_ADDRESSES: Record<string, ReadonlyArray<string>> = {
  '4114': [
    // Fake TAPFREAK - impersonates the real TAPFREAK token
    '0x56ee8fb280a73db7dfff8c887e9765549d8d6c2e',
  ],
};

function getScamTokenAddressesForChain(): Set<string> {
  const chainId = String(chain.id);
  const addresses = SCAM_TOKEN_ADDRESSES[chainId];

  return new Set((addresses ?? []).map(a => a.toLowerCase()));
}

const scamTokenAddresses = getScamTokenAddressesForChain();

export function isScamToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return scamTokenAddresses.has(tokenAddress.toLowerCase());
}
