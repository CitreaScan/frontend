import { Box } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import React from 'react';

import useIsMobile from 'lib/hooks/useIsMobile';
import { createLpTokenBalances, useJuiceSwapPositions } from 'lib/token/useJuiceSwapPositions';
import ActionBar from 'ui/shared/ActionBar';
import DataListDisplay from 'ui/shared/DataListDisplay';
import Pagination from 'ui/shared/pagination/Pagination';
import type { QueryWithPagesResult } from 'ui/shared/pagination/useQueryWithPages';

import ERC20TokensListItem from './ERC20TokensListItem';
import ERC20TokensTable from './ERC20TokensTable';

type Props = {
  tokensQuery: QueryWithPagesResult<'general:address_tokens'>;
};

const ERC20Tokens = ({ tokensQuery }: Props) => {
  const isMobile = useIsMobile();
  const router = useRouter();
  const addressHash = router.query.hash?.toString();

  const { isError, isPlaceholderData, data, pagination } = tokensQuery;

  const lpQuery = useJuiceSwapPositions(addressHash);
  const lpItems = React.useMemo(() => {
    if (!lpQuery.data?.length) {
      return [];
    }
    return createLpTokenBalances(lpQuery.data);
  }, [ lpQuery.data ]);

  const allItems = React.useMemo(() => {
    if (!data?.items) {
      return undefined;
    }
    return lpItems.length > 0 ? [ ...data.items, ...lpItems ] : data.items;
  }, [ data?.items, lpItems ]);

  const actionBar = isMobile && pagination.isVisible && (
    <ActionBar mt={ -6 }>
      <Pagination ml="auto" { ...pagination }/>
    </ActionBar>
  );

  const content = allItems ? (
    <>
      <Box hideBelow="lg"><ERC20TokensTable data={ allItems } top={ pagination.isVisible ? 72 : 0 } isLoading={ isPlaceholderData }/></Box>
      <Box hideFrom="lg">{ allItems.map((item, index) => (
        <ERC20TokensListItem
          key={ item.token.address_hash + (item.token_id ? `-${ item.token_id }` : '') + (isPlaceholderData ? index : '') }
          { ...item }
          isLoading={ isPlaceholderData }
        />
      )) }
      </Box>
    </>
  ) : null;

  return (
    <DataListDisplay
      isError={ isError }
      itemsNum={ allItems?.length }
      emptyText="There are no tokens of selected type."
      actionBar={ actionBar }
    >
      { content }
    </DataListDisplay>
  );

};

export default ERC20Tokens;
