import { Grid } from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import React from 'react';

import type { Address } from 'types/api/address';
import type { NFTTokenType } from 'types/api/token';

import { getResourceKey } from 'lib/api/useApiQuery';
import { useMultichainContext } from 'lib/contexts/multichain';
import useIsMobile from 'lib/hooks/useIsMobile';
import getQueryParamString from 'lib/router/getQueryParamString';
import { NFT_MANAGER, useJuiceSwapPositions } from 'lib/token/useJuiceSwapPositions';
import { apos } from 'toolkit/utils/htmlEntities';
import ActionBar from 'ui/shared/ActionBar';
import DataListDisplay from 'ui/shared/DataListDisplay';
import Pagination from 'ui/shared/pagination/Pagination';
import type { QueryWithPagesResult } from 'ui/shared/pagination/useQueryWithPages';

import { useLpUsdMap } from '../utils/useLpEnhancedTokenData';
import AddressNftTypeFilter from './AddressNftTypeFilter';
import NFTItem from './NFTItem';

type Props = {
  tokensQuery: QueryWithPagesResult<'general:address_nfts'>;
  tokenTypes: Array<NFTTokenType> | undefined;
  onTokenTypesChange: (value: Array<NFTTokenType>) => void;
};

const AddressNFTs = ({ tokensQuery, tokenTypes, onTokenTypesChange }: Props) => {
  const isMobile = useIsMobile();
  const multichainContext = useMultichainContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addressHash = getQueryParamString(router.query.hash);

  const { isError, isPlaceholderData, data, pagination } = tokensQuery;

  const addressResourceKey = getResourceKey('general:address', { pathParams: { hash: addressHash } });
  const addressData = queryClient.getQueryData<Address>(addressResourceKey);
  const lpQuery = useJuiceSwapPositions(addressHash);
  const lpUsdMap = useLpUsdMap(lpQuery.data, addressData?.exchange_rate);

  const hasActiveFilters = Boolean(tokenTypes?.length);

  const actionBar = isMobile && pagination.isVisible && (
    <ActionBar mt={ -6 }>
      <AddressNftTypeFilter value={ tokenTypes } onChange={ onTokenTypesChange }/>
      <Pagination ml="auto" { ...pagination }/>
    </ActionBar>
  );

  const content = data?.items ? (
    <Grid
      w="100%"
      columnGap={{ base: 3, lg: 6 }}
      rowGap={{ base: 3, lg: 6 }}
      gridTemplateColumns={{ base: 'repeat(2, calc((100% - 12px)/2))', lg: 'repeat(auto-fill, minmax(210px, 1fr))' }}
    >
      { data.items.map((item, index) => {
        const key = item.token.address_hash + '_' + (item.id && !isPlaceholderData ? `id_${ item.id }` : `index_${ index }`);
        const isJuiceSwap = item.token.address_hash.toLowerCase() === NFT_MANAGER.toLowerCase();

        return (
          <NFTItem
            key={ key }
            { ...item }
            isLoading={ isPlaceholderData }
            withTokenLink
            chain={ multichainContext?.chain }
            usdValue={ isJuiceSwap && item.id ? lpUsdMap[item.id] : undefined }
          />
        );
      }) }
    </Grid>
  ) : null;

  return (
    <DataListDisplay
      isError={ isError }
      itemsNum={ data?.items?.length }
      emptyText="There are no tokens of selected type."
      actionBar={ actionBar }
      filterProps={{
        emptyFilteredText: `Couldn${ apos }t find any token that matches your query.`,
        hasActiveFilters,
      }}
    >
      { content }
    </DataListDisplay>
  );
};

export default AddressNFTs;
