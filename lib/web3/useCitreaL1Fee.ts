import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import type { Hash } from 'viem';

import { publicClient } from './client';

interface CitreaTransactionReceipt {
  l1DiffSize?: string;
  l1FeeRate?: string;
}

interface CitreaL1FeeResult {
  l1Fee: string | null;
  l1DiffSize: string | null;
  l1FeeRate: string | null;
  isLoading: boolean;
  error: Error | null;
}

async function fetchCitreaL1Fee(hash: Hash): Promise<{ l1Fee: string; l1DiffSize: string; l1FeeRate: string } | null> {
  if (!publicClient) {
    return null;
  }

  const receipt = await publicClient.request({
    method: 'eth_getTransactionReceipt' as 'eth_getTransactionReceipt',
    params: [ hash ],
  }) as CitreaTransactionReceipt | null;

  if (!receipt || !receipt.l1DiffSize || !receipt.l1FeeRate) {
    return null;
  }

  // Parse hex values (e.g., "0x34" -> 52)
  const l1DiffSize = BigNumber(receipt.l1DiffSize.replace('0x', ''), 16);
  const l1FeeRate = BigNumber(receipt.l1FeeRate.replace('0x', ''), 16);
  const l1Fee = l1DiffSize.multipliedBy(l1FeeRate);

  return {
    l1Fee: l1Fee.toString(),
    l1DiffSize: l1DiffSize.toString(),
    l1FeeRate: l1FeeRate.toString(),
  };
}

export default function useCitreaL1Fee(hash: Hash | undefined): CitreaL1FeeResult {
  const { data, isLoading, error } = useQuery({
    queryKey: [ 'citrea-l1-fee', hash ],
    queryFn: () => fetchCitreaL1Fee(hash!),
    enabled: Boolean(hash && publicClient),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return {
    l1Fee: data?.l1Fee ?? null,
    l1DiffSize: data?.l1DiffSize ?? null,
    l1FeeRate: data?.l1FeeRate ?? null,
    isLoading,
    error: error as Error | null,
  };
}
