import useApiQuery from 'lib/api/useApiQuery';

type InternalValueFlow = { 'in': string; out: string };

export default function useInternalValueFlowFromAddress(
  txHash: string | undefined,
  fromAddressHash: string | undefined,
) {
  const { data, isLoading } = useApiQuery('general:address_txs', {
    pathParams: { hash: fromAddressHash ?? '' },
    queryParams: { items_count: 50 },
    queryOptions: {
      enabled: Boolean(txHash && fromAddressHash),
      staleTime: 60 * 1000,
    },
  });

  const flow: InternalValueFlow | undefined = (() => {
    if (!data?.items?.length || !txHash) return undefined;
    const tx = data.items.find((t) => t.hash === txHash);
    const f = tx?.internal_value_flow;
    if (!f || (f.in === '0' && f.out === '0')) return undefined;
    return f;
  })();

  return { flow, isLoading };
}
