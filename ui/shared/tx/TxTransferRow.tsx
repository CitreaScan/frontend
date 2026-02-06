import { Flex } from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import React from 'react';

import type { Transaction } from 'types/api/transaction';

import { currencyUnits } from 'lib/units';
import CurrencyValue from 'ui/shared/CurrencyValue';
import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';
import AddressEntity from 'ui/shared/entities/address/AddressEntity';

interface Props {
  data: Transaction;
  isLoading: boolean;
}

function getClaimToAddress(data: Transaction) {
  const params = data.decoded_input?.parameters;
  if (!params?.length) return null;
  const claimAddress = params.find((p) => p.name === 'claimAddress');
  if (claimAddress && typeof claimAddress.value === 'string') {
    return { hash: claimAddress.value };
  }
  return null;
}

const TxTransferRow = ({ data, isLoading }: Props) => {
  const flow = data.internal_value_flow;
  if (!flow || (flow.in === '0' && flow.out === '0')) return null;

  const method = data.method?.toLowerCase();
  if (method !== 'claim' && method !== 'claimbatch' && method !== 'refund' && method !== 'lock' && method !== 'deposit') return null;

  const netValue = BigNumber(flow.in).minus(BigNumber(flow.out)).abs();
  if (netValue.lte(0)) return null;

  const isLockOrDeposit = method === 'lock' || method === 'deposit';
  const fromAddress = isLockOrDeposit ? data.from : data.to;
  let toAddress;
  if (isLockOrDeposit) {
    toAddress = data.to;
  } else if (method === 'refund') {
    toAddress = data.from;
  } else {
    toAddress = getClaimToAddress(data) || data.from;
  }
  if (!fromAddress?.hash || !toAddress?.hash) return null;

  return (
    <>
      <DetailedInfo.ItemLabel
        hint="Value transfer from contract to recipient"
        isLoading={ isLoading }
      >
        Transfer
      </DetailedInfo.ItemLabel>
      <DetailedInfo.ItemValue>
        <Flex alignItems="center" flexWrap="wrap" gap={ 2 }>
          <CurrencyValue
            value={ netValue.toString() }
            currency={ currencyUnits.ether }
            exchangeRate={ data.exchange_rate }
            isLoading={ isLoading }
            accuracyUsd={ 2 }
          />
          <span>from</span>
          <AddressEntity address={ fromAddress } isLoading={ isLoading } noIcon/>
          <span>to</span>
          <AddressEntity address={ toAddress } isLoading={ isLoading } noIcon/>
        </Flex>
      </DetailedInfo.ItemValue>
    </>
  );
};

export default React.memo(TxTransferRow);
