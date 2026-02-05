import BigNumber from 'bignumber.js';
import React from 'react';

import type { Transaction } from 'types/api/transaction';

import useInternalValueFlowFromAddress from 'lib/tx/useInternalValueFlowFromAddress';
import { currencyUnits } from 'lib/units';
import CurrencyValue from 'ui/shared/CurrencyValue';
import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';
import TxInternalValueFlowBreakdown from 'ui/shared/tx/TxInternalValueFlowBreakdown';

interface Props {
  data: Transaction;
  isLoading: boolean;
}

const TxInternalValueFlow = ({ data, isLoading }: Props) => {
  const { flow: flowFromAddress, isLoading: isAddressTxsLoading } = useInternalValueFlowFromAddress(
    data?.hash,
    data?.from?.hash,
  );
  const flow = data?.internal_value_flow ?? flowFromAddress;
  const loading = isLoading || (!data?.internal_value_flow && Boolean(data?.hash && data?.from?.hash) && isAddressTxsLoading);

  if (!flow || (flow.in === '0' && flow.out === '0')) {
    return null;
  }

  const displayData = flow && !data.internal_value_flow ?
    { ...data, internal_value_flow: flow } :
    data;

  const netValue = BigNumber(flow.in).minus(BigNumber(flow.out));

  return (
    <>
      <DetailedInfo.ItemLabel
        hint="Value received and sent via internal transactions"
        isLoading={ loading }
      >
        Internal value flow
      </DetailedInfo.ItemLabel>
      <DetailedInfo.ItemValue multiRow>
        <CurrencyValue
          value={ netValue.toString() }
          currency={ currencyUnits.ether }
          exchangeRate={ 'exchange_rate' in displayData ? displayData.exchange_rate : null }
          isLoading={ loading }
          flexWrap="wrap"
          mr={ 3 }
          rowGap={ 0 }
          accuracyUsd={ 2 }
        />
        <TxInternalValueFlowBreakdown data={ displayData } isLoading={ loading }/>
      </DetailedInfo.ItemValue>
    </>
  );
};

export default React.memo(TxInternalValueFlow);
