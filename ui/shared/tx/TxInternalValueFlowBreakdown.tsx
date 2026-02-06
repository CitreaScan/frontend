import React from 'react';

import type { Transaction } from 'types/api/transaction';

import { currencyUnits } from 'lib/units';
import CurrencyValue from 'ui/shared/CurrencyValue';
import * as DetailedInfoItemBreakdown from 'ui/shared/DetailedInfo/DetailedInfoItemBreakdown';

interface Props {
  data: Transaction;
  isLoading: boolean;
}

const TxInternalValueFlowBreakdown = ({ data, isLoading }: Props) => {
  const flow = data.internal_value_flow!;
  return (
    <DetailedInfoItemBreakdown.Container loading={ isLoading } noScroll>
      <DetailedInfoItemBreakdown.Row
        label="In"
        hint="Value received via internal transactions"
      >
        <CurrencyValue
          value={ flow.in }
          currency={ currencyUnits.ether }
          exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
          isLoading={ isLoading }
          flexWrap="wrap"
          rowGap={ 0 }
          accuracyUsd={ 2 }
        />
      </DetailedInfoItemBreakdown.Row>
      <DetailedInfoItemBreakdown.Row
        label="Out"
        hint="Value sent via internal transactions"
      >
        <CurrencyValue
          value={ flow.out }
          currency={ currencyUnits.ether }
          exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
          isLoading={ isLoading }
          flexWrap="wrap"
          rowGap={ 0 }
          accuracyUsd={ 2 }
        />
      </DetailedInfoItemBreakdown.Row>
    </DetailedInfoItemBreakdown.Container>
  );
};

export default React.memo(TxInternalValueFlowBreakdown);
