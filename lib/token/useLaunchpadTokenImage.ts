import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

const METADATA_STALE_TIME = 24 * 60 * 60 * 1000; // 24 hours (metadata is immutable)

// JuiceSwap Ponder API URLs by chain ID
const PONDER_API_URLS: Record<string, string> = {
  '4114': 'https://ponder.juiceswap.com', // Citrea Mainnet
  '5115': 'https://dev.ponder.juiceswap.com', // Citrea Testnet
};

interface LaunchpadTokenResponse {
  token?: {
    metadataURI?: string | null;
  };
}

interface TokenMetadata {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
}

/**
 * Convert ipfs:// or ar:// URI to HTTP gateway URL
 */
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  if (uri.startsWith('ar://')) {
    return uri.replace('ar://', 'https://arweave.net/');
  }
  return uri;
}

/**
 * Fetch launchpad token info from JuiceSwap Ponder API
 */
async function fetchLaunchpadToken(tokenAddress: string, ponderUrl: string): Promise<LaunchpadTokenResponse> {
  const response = await fetch(`${ ponderUrl }/launchpad/token/${ tokenAddress.toLowerCase() }`);

  if (!response.ok) {
    if (response.status === 404) {
      return { token: undefined };
    }
    throw new Error(`Ponder API error: ${ response.status }`);
  }

  return response.json() as Promise<LaunchpadTokenResponse>;
}

/**
 * Fetch token metadata from IPFS/Arweave/HTTPS
 */
async function fetchTokenMetadata(metadataURI: string): Promise<TokenMetadata> {
  const url = ipfsToHttp(metadataURI);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Metadata fetch error: ${ response.status }`);
  }

  return response.json() as Promise<TokenMetadata>;
}

/**
 * Fetch launchpad token image URL
 * Returns the HTTP gateway URL for the token image, or null if not found
 */
async function fetchLaunchpadTokenImage(tokenAddress: string): Promise<string | null> {
  const chainId = String(config.chain.id);
  const ponderUrl = PONDER_API_URLS[chainId];

  if (!ponderUrl) {
    return null;
  }

  try {
    // Step 1: Get metadataURI from Ponder API
    const launchpadData = await fetchLaunchpadToken(tokenAddress, ponderUrl);

    if (!launchpadData.token?.metadataURI) {
      return null;
    }

    // Step 2: Fetch metadata JSON from IPFS
    const metadata = await fetchTokenMetadata(launchpadData.token.metadataURI);

    if (!metadata.image) {
      return null;
    }

    // Step 3: Convert IPFS URI to HTTP URL
    return ipfsToHttp(metadata.image);
  } catch {
    return null;
  }
}

/**
 * Hook to fetch launchpad token image from JuiceSwap
 * Use this as a fallback when a token doesn't have an icon_url
 *
 * @param tokenAddress - The token contract address
 * @param enabled - Whether to enable the query (e.g., only when icon_url is missing)
 */
export function useLaunchpadTokenImage(tokenAddress: string | undefined, enabled: boolean = true) {
  const chainId = String(config.chain.id);
  const hasPonderApi = Boolean(PONDER_API_URLS[chainId]);

  return useQuery({
    queryKey: [ 'launchpad-token-image', chainId, tokenAddress?.toLowerCase() ],
    queryFn: () => fetchLaunchpadTokenImage(tokenAddress ?? ''),
    staleTime: METADATA_STALE_TIME,
    gcTime: METADATA_STALE_TIME,
    enabled: enabled && hasPonderApi && Boolean(tokenAddress),
    retry: 1,
  });
}
