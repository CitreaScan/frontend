import { Box } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import React from 'react';

import type { TabItemRegular } from 'toolkit/components/AdaptiveTabs/types';
import type { EntityTag as TEntityTag } from 'ui/shared/EntityTags/types';

import config from 'configs/app';
import useApiQuery from 'lib/api/useApiQuery';
import throwOnResourceLoadError from 'lib/errors/throwOnResourceLoadError';
import getQueryParamString from 'lib/router/getQueryParamString';
import useEtherscanRedirects from 'lib/router/useEtherscanRedirects';
import { publicClient } from 'lib/web3/client';
import { toaster } from 'toolkit/chakra/toaster';
import RoutedTabs from 'toolkit/components/RoutedTabs/RoutedTabs';
import TextAd from 'ui/shared/ad/TextAd';
import AppErrorTxNotFound from 'ui/shared/AppError/custom/AppErrorTxNotFound';
import isCustomAppError from 'ui/shared/AppError/isCustomAppError';
import EntityTags from 'ui/shared/EntityTags/EntityTags';
import PageTitle from 'ui/shared/Page/PageTitle';
import TxAssetFlows from 'ui/tx/TxAssetFlows';
import TxAuthorizations from 'ui/tx/TxAuthorizations';
import TxBlobs from 'ui/tx/TxBlobs';
import TxDetails from 'ui/tx/TxDetails';
import TxDetailsDegraded from 'ui/tx/TxDetailsDegraded';
import TxDetailsWrapped from 'ui/tx/TxDetailsWrapped';
import TxInternals from 'ui/tx/TxInternals';
import TxLogs from 'ui/tx/TxLogs';
import TxRawTrace from 'ui/tx/TxRawTrace';
import TxSearching from 'ui/tx/TxSearching';
import TxState from 'ui/tx/TxState';
import TxSubHeading from 'ui/tx/TxSubHeading';
import TxTokenTransfer from 'ui/tx/TxTokenTransfer';
import TxUserOps from 'ui/tx/TxUserOps';
import useTxQuery from 'ui/tx/useTxQuery';

const txInterpretation = config.features.txInterpretation;
const rollupFeature = config.features.rollup;
const tacFeature = config.features.tac;

const TransactionPageContent = () => {
  const router = useRouter();
  const hash = getQueryParamString(router.query.hash);

  useEtherscanRedirects();

  const txQuery = useTxQuery();

  const tacOperationQuery = useApiQuery('tac:operation_by_tx_hash', {
    pathParams: { tx_hash: hash },
    queryOptions: {
      enabled: tacFeature.isEnabled,
    },
  });

  const { data, isPlaceholderData, isError, error, errorUpdateCount } = txQuery;

  const [ isSearching, setIsSearching ] = React.useState(false);
  const [ searchCompleted, setSearchCompleted ] = React.useState(false);
  const searchAttemptedRef = React.useRef(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isError && error && (error.status === 404 || error.status === 422) && !searchAttemptedRef.current) {
      searchAttemptedRef.current = true;
      setIsSearching(true);
      setSearchCompleted(false);
      txQuery.setRefetchEnabled(true);

      searchTimeoutRef.current = setTimeout(() => {
        txQuery.setRefetchEnabled(false);
        setIsSearching(false);
        setSearchCompleted(true);
      }, 30000);
    }
  }, [ isError, error, hash, txQuery ]);

  // Reset search state when hash changes
  React.useEffect(() => {
    return () => {
      searchAttemptedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [ hash ]);

  // Stop searching when transaction is found
  React.useEffect(() => {
    if (isSearching && !isError && data && !isPlaceholderData) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      txQuery.setRefetchEnabled(false);
      setIsSearching(false);
    }
  }, [ isSearching, isError, data, isPlaceholderData, txQuery ]);

  // Show/hide toast during search
  const SEARCH_TOAST_ID = 'tx-search-toast';
  React.useEffect(() => {
    if (isSearching) {
      toaster.loading({
        id: SEARCH_TOAST_ID,
        title: 'Transaction pending...',
        description: 'Waiting for confirmation',
        duration: Infinity,
      });
    } else {
      toaster.remove(SEARCH_TOAST_ID);
    }
  }, [ isSearching ]);

  const showDegradedView = publicClient && ((isError && error.status !== 422) || isPlaceholderData) && errorUpdateCount > 0 && !isSearching && !isError;

  const searchingComponent = React.useMemo(() => <TxSearching/>, []);

  const tabs: Array<TabItemRegular> = React.useMemo(() => {
    let detailsComponent;
    if (isSearching) {
      detailsComponent = searchingComponent;
    } else if (showDegradedView) {
      detailsComponent = <TxDetailsDegraded hash={ hash } txQuery={ txQuery }/>;
    } else {
      detailsComponent = <TxDetails txQuery={ txQuery } tacOperationQuery={ tacFeature.isEnabled ? tacOperationQuery : undefined }/>;
    }

    return [
      {
        id: 'index',
        title: config.features.suave.isEnabled && data?.wrapped ? 'Confidential compute tx details' : 'Details',
        component: detailsComponent,
      },
      txInterpretation.isEnabled && txInterpretation.provider === 'noves' ?
        { id: 'asset_flows', title: 'Asset Flows', component: <TxAssetFlows hash={ hash }/> } :
        undefined,
      config.features.suave.isEnabled && data?.wrapped ?
        { id: 'wrapped', title: 'Regular tx details', component: <TxDetailsWrapped data={ data.wrapped }/> } :
        undefined,
      { id: 'token_transfers', title: 'Token transfers', component: <TxTokenTransfer txQuery={ txQuery }/> },
      config.features.userOps.isEnabled ?
        { id: 'user_ops', title: 'User operations', component: <TxUserOps txQuery={ txQuery }/> } :
        undefined,
      { id: 'internal', title: 'Internal txns', component: <TxInternals txQuery={ txQuery }/> },
      config.features.dataAvailability.isEnabled && txQuery.data?.blob_versioned_hashes?.length ?
        { id: 'blobs', title: 'Blobs', component: <TxBlobs txQuery={ txQuery }/> } :
        undefined,
      { id: 'logs', title: 'Logs', component: <TxLogs txQuery={ txQuery }/> },
      { id: 'state', title: 'State', component: <TxState txQuery={ txQuery }/> },
      { id: 'raw_trace', title: 'Raw trace', component: <TxRawTrace txQuery={ txQuery }/> },
      txQuery.data?.authorization_list?.length ?
        { id: 'authorizations', title: 'Authorizations', component: <TxAuthorizations txQuery={ txQuery }/> } :
        undefined,
    ].filter(Boolean);
  }, [ isSearching, searchingComponent, showDegradedView, hash, txQuery, tacOperationQuery, data ]);

  const txTags: Array<TEntityTag> = data?.transaction_tag ?
    [ { slug: data.transaction_tag, name: data.transaction_tag, tagType: 'private_tag' as const, ordinal: 1 } ] : [];

  if (rollupFeature.isEnabled && rollupFeature.interopEnabled && data?.op_interop_messages && data.op_interop_messages.length > 0) {
    if (data.op_interop_messages.some(message => message.init_chain !== undefined)) {
      txTags.push({ slug: 'relay_tx', name: 'Relay tx', tagType: 'custom' as const, ordinal: 0 });
    }
    if (data.op_interop_messages.some(message => message.relay_chain !== undefined)) {
      txTags.push({ slug: 'init_tx', name: 'Source tx', tagType: 'custom' as const, ordinal: 0 });
    }
  }

  const protocolTags = data?.to?.metadata?.tags?.filter(tag => tag.tagType === 'protocol');
  if (protocolTags && protocolTags.length > 0) {
    txTags.push(...protocolTags);
  }

  const tags = (
    <EntityTags
      isLoading={ isPlaceholderData || (tacFeature.isEnabled && tacOperationQuery.isPlaceholderData) }
      tags={ txTags }
    />
  );

  const titleSecondRow = isSearching ? null : <TxSubHeading hash={ hash } hasTag={ Boolean(data?.transaction_tag) } txQuery={ txQuery }/>;

  if (isError && !showDegradedView && !isSearching) {
    if (isCustomAppError(error)) {
      if (error.status === 404 || error.status === 422) {
        if (searchCompleted) {
          return (
            <Box mt={{ base: '52px', lg: '104px' }} maxW="800px">
              <AppErrorTxNotFound/>
            </Box>
          );
        }
      } else {
        throwOnResourceLoadError({ resource: 'general:tx', error, isError: true });
      }
    }
  }

  return (
    <>
      <TextAd mb={ 6 }/>
      <PageTitle
        title="Transaction details"
        contentAfter={ tags }
        secondRow={ titleSecondRow }
      />
      <RoutedTabs tabs={ tabs } isLoading={ isPlaceholderData && !isSearching }/>
    </>
  );
};

export default TransactionPageContent;
