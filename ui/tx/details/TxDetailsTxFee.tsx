import BigNumber from 'bignumber.js';
import React from 'react';
import type { Hash } from 'viem';

import type { Transaction } from 'types/api/transaction';

import config from 'configs/app';
import { currencyUnits } from 'lib/units';
import useCitreaL1Fee from 'lib/web3/useCitreaL1Fee';
import CurrencyValue from 'ui/shared/CurrencyValue';
import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';
import * as DetailedInfoItemBreakdown from 'ui/shared/DetailedInfo/DetailedInfoItemBreakdown';

interface Props {
  isLoading: boolean;
  data: Transaction;
}

const TxDetailsTxFee = ({ isLoading, data }: Props) => {
  const { l1Fee, isLoading: isL1FeeLoading } = useCitreaL1Fee(data.hash as Hash);

  if (config.UI.views.tx.hiddenFields?.tx_fee) {
    return null;
  }

  const l2Fee = BigNumber(data.fee.value || 0);
  const l1FeeBn = BigNumber(l1Fee || 0);
  const totalFee = l2Fee.plus(l1FeeBn);
  const hasL1Fee = l1Fee !== null && l1FeeBn.gt(0);
  const combinedLoading = isLoading || isL1FeeLoading;

  const content = (() => {
    if (!config.UI.views.tx.groupedFees && !hasL1Fee) {
      return (
        <CurrencyValue
          value={ totalFee.toString() }
          currency={ currencyUnits.ether }
          exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
          isLoading={ combinedLoading }
          showGweiTooltip
          flexWrap="wrap"
          rowGap={ 0 }
          accuracyUsd={ 2 }
        />
      );
    }

    // Show breakdown when hasL1Fee or groupedFees is enabled
    return (
      <>
        <CurrencyValue
          value={ totalFee.toString() }
          currency={ currencyUnits.ether }
          exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
          isLoading={ combinedLoading }
          showGweiTooltip
          flexWrap="wrap"
          mr={ 3 }
          rowGap={ 0 }
          accuracyUsd={ 2 }
        />
        <DetailedInfoItemBreakdown.Container loading={ combinedLoading }>
          <DetailedInfoItemBreakdown.Row
            label="L2 execution fee"
            hint="Fee for executing the transaction on L2"
          >
            <CurrencyValue
              value={ l2Fee.toString() }
              currency={ currencyUnits.ether }
              exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
              isLoading={ combinedLoading }
              showGweiTooltip
              flexWrap="wrap"
              rowGap={ 0 }
              accuracyUsd={ 2 }
            />
          </DetailedInfoItemBreakdown.Row>
          { hasL1Fee && (
            <DetailedInfoItemBreakdown.Row
              label="L1 data fee"
              hint="Fee for posting transaction data to Bitcoin L1"
            >
              <CurrencyValue
                value={ l1FeeBn.toString() }
                currency={ currencyUnits.ether }
                exchangeRate={ 'exchange_rate' in data ? data.exchange_rate : null }
                isLoading={ combinedLoading }
                showGweiTooltip
                flexWrap="wrap"
                rowGap={ 0 }
                accuracyUsd={ 2 }
              />
            </DetailedInfoItemBreakdown.Row>
          ) }
        </DetailedInfoItemBreakdown.Container>
      </>
    );
  })();

  return (
    <>
      <DetailedInfo.ItemLabel
        hint={ hasL1Fee ? 'Total fee including L2 execution and L1 data fee' : 'Total transaction fee' }
        isLoading={ combinedLoading }
      >
        Transaction fee
      </DetailedInfo.ItemLabel>
      <DetailedInfo.ItemValue multiRow>
        { content }
      </DetailedInfo.ItemValue>
    </>
  );
};

export default React.memo(TxDetailsTxFee);
