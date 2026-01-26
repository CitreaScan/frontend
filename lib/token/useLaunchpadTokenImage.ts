import { useQuery } from '@tanstack/react-query';

import config from 'configs/app';

// Supported chain IDs for launchpad
const SUPPORTED_CHAIN_IDS = [ '4114', '5115' ];

interface LaunchpadTokenData {
  imageUrl: string | null;
  launchpadUrl: string | null;
}

async function fetchLaunchpadTokenData(tokenAddress: string, chainId: string): Promise<LaunchpadTokenData> {
  const response = await fetch(`/api/launchpad-token?address=${ tokenAddress.toLowerCase() }&chainId=${ chainId }`);

  if (!response.ok) {
    return { imageUrl: null, launchpadUrl: null };
  }

  return response.json() as Promise<LaunchpadTokenData>;
}

/**
 * Hook to fetch launchpad token data from JuiceSwap
 * Use this as a fallback when a token doesn't have an icon_url
 *
 * @param tokenAddress - The token contract address
 * @param enabled - Whether to enable the query (e.g., only when icon_url is missing)
 * @returns Query result with { imageUrl, launchpadUrl }
 */
export function useLaunchpadTokenImage(tokenAddress: string | undefined, enabled: boolean = true) {
  const chainId = String(config.chain.id);
  const isSupported = SUPPORTED_CHAIN_IDS.includes(chainId);

  return useQuery({
    queryKey: [ 'launchpad-token-data', chainId, tokenAddress?.toLowerCase() ],
    queryFn: () => fetchLaunchpadTokenData(tokenAddress ?? '', chainId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (metadata is immutable)
    gcTime: 24 * 60 * 60 * 1000,
    enabled: enabled && isSupported && Boolean(tokenAddress),
    retry: 2,
  });
}
