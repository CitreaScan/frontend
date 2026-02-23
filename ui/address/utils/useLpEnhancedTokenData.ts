import type BigNumber from 'bignumber.js';
import React from 'react';

import { useTokenPrices } from 'lib/token/TokenPricesInitializer';
import type { JuiceSwapPosition } from 'lib/token/useJuiceSwapPositions';
import { NFT_MANAGER, createLpTokenBalances } from 'lib/token/useJuiceSwapPositions';

import type { TokenSelectData } from './tokenUtils';

/**
 * Merges LP positions into token data, replacing the generic NFT Manager entry
 * with individual LP position items under ERC-721.
 */
export function useLpEnhancedTokenData(
  data: TokenSelectData,
  lpPositions: Array<JuiceSwapPosition> | undefined,
  exchangeRate?: string | null,
): TokenSelectData {
  const { version: pricesVersion } = useTokenPrices();

  return React.useMemo(() => {
    if (!lpPositions?.length) {
      return data;
    }
    const lpItems = createLpTokenBalances(lpPositions, exchangeRate);
    const filteredErc721 = data['ERC-721'].items.filter(
      item => item.token.address_hash.toLowerCase() !== NFT_MANAGER.toLowerCase(),
    );
    return {
      ...data,
      'ERC-721': {
        ...data['ERC-721'],
        items: [ ...filteredErc721, ...lpItems ],
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pricesVersion triggers recompute when vault prices load
  }, [ data, lpPositions, exchangeRate, pricesVersion ]);
}

/**
 * Creates a map of tokenId → BigNumber USD value for LP positions.
 * Used by NFT card views (AddressCollections, AddressNFTs) to display USD on cards.
 */
export function useLpUsdMap(
  lpPositions: Array<JuiceSwapPosition> | undefined,
  exchangeRate?: string | null,
): Record<string, BigNumber> {
  const { version: pricesVersion } = useTokenPrices();

  return React.useMemo(() => {
    if (!lpPositions?.length) {
      return {} as Record<string, BigNumber>;
    }
    const balances = createLpTokenBalances(lpPositions, exchangeRate);
    const map: Record<string, BigNumber> = {};
    for (let i = 0; i < lpPositions.length; i++) {
      if (balances[i].usd) {
        map[lpPositions[i].tokenId.toString()] = balances[i].usd!;
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pricesVersion triggers recompute when vault prices load
  }, [ lpPositions, exchangeRate, pricesVersion ]);
}
