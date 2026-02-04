import React from 'react';

import isWalletChainNotAddedError from './isWalletChainNotAddedError';
import useAddChain from './useAddChain';
import useProvider from './useProvider';
import useSwitchChain from './useSwitchChain';

export default function useSwitchOrAddChain() {
  const { wallet, provider } = useProvider();
  const addChain = useAddChain();
  const switchChain = useSwitchChain();

  return React.useCallback(async() => {
    if (!wallet || !provider) {
      return;
    }

    try {
      return switchChain();
    } catch (error) {
      if (isWalletChainNotAddedError(error)) {
        return addChain();
      }
      throw error;
    }
  }, [ addChain, provider, wallet, switchChain ]);
}
