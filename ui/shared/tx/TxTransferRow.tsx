import { Flex } from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import React from 'react';

import type { AddressParam } from 'types/api/addressParams';
import type { Transaction } from 'types/api/transaction';

import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';
import AddressEntity from 'ui/shared/entities/address/AddressEntity';

interface Props {
  data: Transaction;
  isLoading: boolean;
  internalTransfer?: { from: AddressParam; to: AddressParam };
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

const TxTransferRow = ({ data, isLoading, internalTransfer }: Props) => {
  const flow = data.internal_value_flow;
  if (!flow || (flow.in === '0' && flow.out === '0')) return null;

  const method = data.method?.toLowerCase();
  if (method !== 'claim' && method !== 'claimbatch' && method !== 'refund' && method !== 'lock' && method !== 'deposit') return null;

  const netValue = BigNumber(flow.in).minus(BigNumber(flow.out)).abs();
  if (netValue.lte(0)) return null;

  let fromAddress: { hash: string } | undefined;
  let toAddress: { hash: string } | undefined;
  if (internalTransfer) {
    fromAddress = internalTransfer.from;
    toAddress = internalTransfer.to;
  } else {
    const isLockOrDeposit = method === 'lock' || method === 'deposit';
    fromAddress = isLockOrDeposit ? data.from : data.to ?? undefined;
    if (isLockOrDeposit) {
      toAddress = data.to ?? undefined;
    } else if (method === 'refund') {
      toAddress = data.from ?? undefined;
    } else {
      toAddress = getClaimToAddress(data) ?? data.from ?? undefined;
    }
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
      <DetailedInfo.ItemValue minW={ 0 } overflow="hidden">
        <Flex alignItems="center" flexWrap="wrap" gap={ 2 } minW={ 0 } maxW="100%">
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
