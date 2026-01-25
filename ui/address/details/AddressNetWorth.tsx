import { Text, Flex } from '@chakra-ui/react';
import React from 'react';

import type { Address } from 'types/api/address';

import config from 'configs/app';
import getCurrencyValue from 'lib/getCurrencyValue';
import * as mixpanel from 'lib/mixpanel/index';
import { useEquityPrices } from 'lib/token/useEquityPrices';
import { useVaultPrices } from 'lib/token/useVaultPrices';
import { Skeleton } from 'toolkit/chakra/skeleton';
import TextSeparator from 'ui/shared/TextSeparator';

import { getTokensTotalInfo } from '../utils/tokenUtils';
import useFetchTokens from '../utils/useFetchTokens';
import AddressMultichainButton from './AddressMultichainButton';

const multichainFeature = config.features.multichainButton;

type Props = {
  addressHash: string;
  addressData?: Address;
  isLoading?: boolean;
};

const AddressNetWorth = ({ addressData, isLoading, addressHash }: Props) => {
  // Fetch and cache vault token prices (e.g., svJUSD)
  const { data: vaultPrices } = useVaultPrices();
  // Fetch and cache equity token prices (e.g., JUICE)
  const { data: equityPrices } = useEquityPrices();

  const pricesVersion = (vaultPrices ? Object.keys(vaultPrices).length : 0) +
    (equityPrices ? Object.keys(equityPrices).length : 0);

  const { data, isError, isPending } = useFetchTokens({
    hash: addressData?.hash,
    enabled: addressData?.has_tokens,
    vaultPricesVersion: pricesVersion,
  });

  const { usdBn: nativeUsd } = getCurrencyValue({
    value: addressData?.coin_balance || '0',
    accuracy: 8,
    accuracyUsd: 2,
    exchangeRate: addressData?.exchange_rate,
    decimals: String(config.chain.currency.decimals),
  });

  const { usd, isOverflow } = getTokensTotalInfo(data);
  const prefix = isOverflow ? '>' : '';

  const totalUsd = nativeUsd.plus(usd);

  const onMultichainClick = React.useCallback(() => {
    mixpanel.logEvent(mixpanel.EventTypes.BUTTON_CLICK, { Content: 'Multichain', Source: 'address' });
  }, []);

  let multichainItems = null;

  if (multichainFeature.isEnabled && !addressData?.is_contract) {
    const { providers } = multichainFeature;
    const hasSingleProvider = providers.length === 1;

    multichainItems = (
      <>
        <TextSeparator/>
        <Flex alignItems="center" columnGap={ 2 }>
          <Text>Multichain</Text>
          { providers.map((item) => (
            <AddressMultichainButton
              key={ item.name }
              item={ item }
              addressHash={ addressHash }
              onClick={ onMultichainClick }
              hasSingleProvider={ hasSingleProvider }
            />
          ))
          }
        </Flex>
      </>
    );
  }

  return (
    <Skeleton display="flex" alignItems="center" flexWrap="wrap" loading={ isLoading && !(addressData?.has_tokens && isPending) }>
      <Text>
        { (isError || !addressData?.exchange_rate) ? 'N/A' : `${ prefix }$${ totalUsd.toFormat(2) }` }
      </Text>
      { multichainItems }
    </Skeleton>
  );
};

export default AddressNetWorth;
