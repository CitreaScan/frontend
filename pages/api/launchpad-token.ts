import type { NextApiRequest, NextApiResponse } from 'next';

// JuiceSwap Ponder API URLs by chain ID
const PONDER_API_URLS: Record<string, string> = {
  '4114': 'https://ponder.juiceswap.com',
  '5115': 'https://dev.ponder.juiceswap.com',
};

// JuiceSwap Launchpad URLs by chain ID
const LAUNCHPAD_URLS: Record<string, string> = {
  '4114': 'https://bapp.juiceswap.com/launchpad',
  '5115': 'https://dev.bapp.juiceswap.com/launchpad',
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

interface LaunchpadTokenData {
  imageUrl: string | null;
  launchpadUrl: string | null;
}

function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  if (uri.startsWith('ar://')) {
    return uri.replace('ar://', 'https://arweave.net/');
  }
  return uri;
}

const handler = async(req: NextApiRequest, res: NextApiResponse<LaunchpadTokenData | { error: string }>) => {
  const { address, chainId } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing address parameter' });
  }

  if (!chainId || typeof chainId !== 'string') {
    return res.status(400).json({ error: 'Missing chainId parameter' });
  }

  const ponderUrl = PONDER_API_URLS[chainId];
  const launchpadBaseUrl = LAUNCHPAD_URLS[chainId];

  if (!ponderUrl) {
    return res.status(200).json({ imageUrl: null, launchpadUrl: null });
  }

  try {
    // Step 1: Get metadataURI from Ponder API
    const ponderResponse = await fetch(`${ ponderUrl }/launchpad/token/${ address.toLowerCase() }`);

    if (!ponderResponse.ok) {
      if (ponderResponse.status === 404 || ponderResponse.status === 503) {
        return res.status(200).json({ imageUrl: null, launchpadUrl: null });
      }
      return res.status(ponderResponse.status).json({ error: `Ponder API error: ${ ponderResponse.status }` });
    }

    const ponderData = await ponderResponse.json() as LaunchpadTokenResponse;

    if (!ponderData.token?.metadataURI) {
      return res.status(200).json({ imageUrl: null, launchpadUrl: null });
    }

    const launchpadUrl = launchpadBaseUrl ? `${ launchpadBaseUrl }/${ address }` : null;

    // Step 2: Fetch metadata from IPFS
    const metadataUrl = ipfsToHttp(ponderData.token.metadataURI);
    const metadataResponse = await fetch(metadataUrl);

    if (!metadataResponse.ok) {
      return res.status(200).json({ imageUrl: null, launchpadUrl });
    }

    const metadata = await metadataResponse.json() as TokenMetadata;

    if (!metadata.image) {
      return res.status(200).json({ imageUrl: null, launchpadUrl });
    }

    // Step 3: Convert image URI to HTTP URL
    const imageUrl = ipfsToHttp(metadata.image);

    return res.status(200).json({ imageUrl, launchpadUrl });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch launchpad token data' });
  }
};

export default handler;
