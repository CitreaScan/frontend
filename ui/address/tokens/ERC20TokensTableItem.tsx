import { Flex, HStack } from '@chakra-ui/react';
import React from 'react';

import type { AddressTokenBalance } from 'types/api/address';

import config from 'configs/app';
import useApiQuery from 'lib/api/useApiQuery';
import getCurrencyValue from 'lib/getCurrencyValue';
import { getEffectiveExchangeRate } from 'lib/token/stablecoins';
import { useTokenPrices } from 'lib/token/TokenPricesInitializer';
import { Skeleton } from 'toolkit/chakra/skeleton';
import { TableCell, TableRow } from 'toolkit/chakra/table';
import AddressAddToWallet from 'ui/shared/address/AddressAddToWallet';
import NativeTokenTag from 'ui/shared/celo/NativeTokenTag';
import AddressEntity from 'ui/shared/entities/address/AddressEntity';
import TokenEntity from 'ui/shared/entities/token/TokenEntity';

type Props = AddressTokenBalance & { isLoading: boolean };

const celoFeature = config.features.celo;

const ERC20TokensTableItem = ({
  token,
  value,
  isLoading,
}: Props) => {
  useTokenPrices();
  const statsQuery = useApiQuery('general:stats', {
    queryOptions: { refetchOnMount: false },
  });
  const nativeExchangeRate = statsQuery.data?.coin_price;

  const effectiveExchangeRate = getEffectiveExchangeRate(
    token.address_hash,
    token.exchange_rate,
    nativeExchangeRate,
  );

  const {
    valueStr: tokenQuantity,
    usd: tokenValue,
  } = getCurrencyValue({
    value,
    exchangeRate: token.exchange_rate,
    decimals: token.decimals,
    accuracy: 8,
    accuracyUsd: 2,
    tokenAddress: token.address_hash,
    nativeExchangeRate,
  });

  const isNativeToken = celoFeature.isEnabled &&
    token.address_hash.toLowerCase() === celoFeature.nativeTokenAddress?.toLowerCase();

  return (
    <TableRow role="group" >
      <TableCell verticalAlign="middle">
        <HStack gap={ 2 }>
          <TokenEntity
            token={ token }
            isLoading={ isLoading }
            noCopy
            jointSymbol
            fontWeight="700"
            width="auto"
          />
          { isNativeToken && <NativeTokenTag/> }
        </HStack>
      </TableCell>
      <TableCell verticalAlign="middle">
        <Flex alignItems="center" width="150px" justifyContent="space-between">
          <AddressEntity
            address={{ hash: token.address_hash }}
            isLoading={ isLoading }
            truncation="constant"
            noIcon
          />
          <AddressAddToWallet token={ token } ml={ 4 } isLoading={ isLoading } opacity="0" _groupHover={{ opacity: 1 }}/>
        </Flex>
      </TableCell>
      <TableCell isNumeric verticalAlign="middle">
        <Skeleton loading={ isLoading } display="inline-block" color={ isNativeToken ? 'text.secondary' : undefined }>
          { effectiveExchangeRate && `$${ Number(effectiveExchangeRate).toLocaleString() }` }
        </Skeleton>
      </TableCell>
      <TableCell isNumeric verticalAlign="middle">
        <Skeleton loading={ isLoading } display="inline" color={ isNativeToken ? 'text.secondary' : undefined }>
          { tokenQuantity }
        </Skeleton>
      </TableCell>
      <TableCell isNumeric verticalAlign="middle">
        <Skeleton loading={ isLoading } display="inline" color={ isNativeToken ? 'text.secondary' : undefined }>
          { tokenValue && `$${ tokenValue }` }
        </Skeleton>
      </TableCell>
    </TableRow>
  );
};

export default React.memo(ERC20TokensTableItem);
