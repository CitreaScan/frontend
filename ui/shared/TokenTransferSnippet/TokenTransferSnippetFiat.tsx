import { chakra } from '@chakra-ui/react';
import React from 'react';

import type { TokenInfo } from 'types/api/token';

import useApiQuery from 'lib/api/useApiQuery';
import getCurrencyValue from 'lib/getCurrencyValue';
import TokenEntity from 'ui/shared/entities/token/TokenEntity';

interface Props {
  token: TokenInfo;
  value: string;
  decimals: string | null;
}
const FtTokenTransferSnippet = ({ token, value, decimals }: Props) => {
  const statsQuery = useApiQuery('general:stats', {
    queryOptions: { refetchOnMount: false },
  });
  const nativeExchangeRate = statsQuery.data?.coin_price;

  const { valueStr, usd } = getCurrencyValue({
    value: value,
    exchangeRate: token.exchange_rate,
    accuracyUsd: 2,
    decimals: decimals,
    tokenAddress: token.address_hash,
    nativeExchangeRate,
  });

  return (
    <>
      <chakra.span color="text.secondary">for</chakra.span>
      <span>{ valueStr }</span>
      <TokenEntity
        token={{ ...token, name: token.symbol || token.name }}
        noCopy
        noSymbol
        w="auto"
      />
      { usd && <chakra.span color="text.secondary">(${ usd })</chakra.span> }
    </>
  );
};

export default React.memo(FtTokenTransferSnippet);
