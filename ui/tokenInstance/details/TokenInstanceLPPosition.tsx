import { Text } from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import React from 'react';

import useApiQuery from 'lib/api/useApiQuery';
import { getEffectiveExchangeRate } from 'lib/token/stablecoins';
import { useTokenPrices } from 'lib/token/TokenPricesInitializer';
import { NFT_MANAGER, useJuiceSwapPosition } from 'lib/token/useJuiceSwapPositions';
import { Skeleton } from 'toolkit/chakra/skeleton';
import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';

interface Props {
  tokenHash: string;
  tokenId: string;
  isLoading?: boolean;
}

const TokenInstanceLPPosition = ({ tokenHash, tokenId, isLoading: parentLoading }: Props) => {
  const isLpToken = tokenHash.toLowerCase() === NFT_MANAGER.toLowerCase();

  const positionQuery = useJuiceSwapPosition(isLpToken ? tokenId : undefined);

  // Ensure vault/equity prices are cached for getEffectiveExchangeRate
  useTokenPrices();

  // Get native exchange rate (BTC price) for BTC-pegged tokens
  const statsQuery = useApiQuery('general:stats', {
    queryOptions: { refetchOnMount: false },
  });
  const nativeExchangeRate = statsQuery.data?.coin_price;

  if (!isLpToken) {
    return null;
  }

  const isLoading = parentLoading || positionQuery.isLoading;
  const data = positionQuery.data;

  if (positionQuery.isError) {
    return (
      <>
        <DetailedInfo.ItemDivider/>
        <DetailedInfo.ItemLabel>LP Position</DetailedInfo.ItemLabel>
        <DetailedInfo.ItemValue>
          <Text color="text.secondary">Failed to load LP position data</Text>
        </DetailedInfo.ItemValue>
      </>
    );
  }

  const feePercent = data ? (data.fee / 10000).toFixed(data.fee % 10000 === 0 ? 1 : 2) + '%' : '';

  const formatAmount = (amountWei: string, decimals: number, symbol: string) => {
    const bn = new BigNumber(amountWei).div(new BigNumber(10).pow(decimals));
    return `${ bn.toFormat(bn.isLessThan(1) ? 6 : 2) } ${ symbol }`;
  };

  const formatUsd = (amountWei: string, decimals: number, tokenAddress: string) => {
    const bn = new BigNumber(amountWei).div(new BigNumber(10).pow(decimals));
    const rate = getEffectiveExchangeRate(tokenAddress, null, nativeExchangeRate);
    if (!rate) {
      return null;
    }
    const usd = bn.times(new BigNumber(rate));
    return '$' + usd.toFormat(2);
  };

  const amount0Str = data ? formatAmount(data.amount0Wei, data.token0Decimals, data.token0Symbol) : '';
  const amount1Str = data ? formatAmount(data.amount1Wei, data.token1Decimals, data.token1Symbol) : '';
  const usd0 = data ? formatUsd(data.amount0Wei, data.token0Decimals, data.token0Address) : null;
  const usd1 = data ? formatUsd(data.amount1Wei, data.token1Decimals, data.token1Address) : null;

  const totalUsd = (() => {
    if (!data) {
      return null;
    }
    const bn0 = new BigNumber(data.amount0Wei).div(new BigNumber(10).pow(data.token0Decimals));
    const bn1 = new BigNumber(data.amount1Wei).div(new BigNumber(10).pow(data.token1Decimals));
    const rate0 = getEffectiveExchangeRate(data.token0Address, null, nativeExchangeRate);
    const rate1 = getEffectiveExchangeRate(data.token1Address, null, nativeExchangeRate);
    if (!rate0 && !rate1) {
      return null;
    }
    const usd0Val = rate0 ? bn0.times(new BigNumber(rate0)) : new BigNumber(0);
    const usd1Val = rate1 ? bn1.times(new BigNumber(rate1)) : new BigNumber(0);
    return '$' + usd0Val.plus(usd1Val).toFormat(2);
  })();

  const priceRange = (() => {
    if (!data) {
      return '';
    }
    const priceLower = 1.0001 ** data.tickLower;
    const priceUpper = 1.0001 ** data.tickUpper;
    // Adjust for decimal difference: price = raw_price * 10^(token0Decimals - token1Decimals)
    const decimalAdjust = Math.pow(10, data.token0Decimals - data.token1Decimals);
    const adjLower = priceLower * decimalAdjust;
    const adjUpper = priceUpper * decimalAdjust;

    // If prices are very small, invert to show more intuitive large numbers
    if (adjUpper < 0.001) {
      const invLower = 1 / adjUpper;
      const invUpper = 1 / adjLower;
      const fmt = (v: number) => new BigNumber(v).toFormat(2);
      return `${ fmt(invLower) } – ${ fmt(invUpper) } ${ data.token0Symbol } per ${ data.token1Symbol }`;
    }

    const fmt = (v: number) => new BigNumber(v).toPrecision(6).toString();
    return `${ fmt(adjLower) } – ${ fmt(adjUpper) } ${ data.token1Symbol } per ${ data.token0Symbol }`;
  })();

  const noLiquidity = data && data.liquidity === 0;

  return (
    <>
      <DetailedInfo.ItemDivider/>

      <DetailedInfo.ItemLabel
        hint="JuiceSwap V3 liquidity position details"
        isLoading={ isLoading }
      >
        LP Position
      </DetailedInfo.ItemLabel>
      <DetailedInfo.ItemValue>
        <Skeleton loading={ isLoading }>
          { data ? `${ data.token0Symbol } / ${ data.token1Symbol } · ${ feePercent }` : '' }
        </Skeleton>
      </DetailedInfo.ItemValue>

      { noLiquidity ? (
        <>
          <DetailedInfo.ItemLabel
            isLoading={ isLoading }
          >
            Liquidity
          </DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Skeleton loading={ isLoading }>
              <Text color="text.secondary">No active liquidity</Text>
            </Skeleton>
          </DetailedInfo.ItemValue>
        </>
      ) : (
        <>
          <DetailedInfo.ItemLabel
            hint={ data ? `Amount of ${ data.token0Symbol } in this position` : undefined }
            isLoading={ isLoading }
          >
            { data?.token0Symbol || 'Token 0' }
          </DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Skeleton loading={ isLoading }>
              { amount0Str }{ usd0 && ` (${ usd0 })` }
            </Skeleton>
          </DetailedInfo.ItemValue>

          <DetailedInfo.ItemLabel
            hint={ data ? `Amount of ${ data.token1Symbol } in this position` : undefined }
            isLoading={ isLoading }
          >
            { data?.token1Symbol || 'Token 1' }
          </DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Skeleton loading={ isLoading }>
              { amount1Str }{ usd1 && ` (${ usd1 })` }
            </Skeleton>
          </DetailedInfo.ItemValue>

          { totalUsd && (
            <>
              <DetailedInfo.ItemLabel
                hint="Total USD value of both tokens in this position"
                isLoading={ isLoading }
              >
                Total value
              </DetailedInfo.ItemLabel>
              <DetailedInfo.ItemValue>
                <Skeleton loading={ isLoading }>
                  { totalUsd }
                </Skeleton>
              </DetailedInfo.ItemValue>
            </>
          ) }

          <DetailedInfo.ItemLabel
            hint="The price range in which this position earns fees"
            isLoading={ isLoading }
          >
            Price range
          </DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Skeleton loading={ isLoading }>
              { priceRange }
            </Skeleton>
          </DetailedInfo.ItemValue>

          <DetailedInfo.ItemLabel
            hint="Whether the current pool price is within this position's range"
            isLoading={ isLoading }
          >
            Status
          </DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Skeleton loading={ isLoading }>
              { data?.inRange ? (
                <Text as="span" color="green.500">In range</Text>
              ) : (
                <Text as="span" color="red.500">Out of range</Text>
              ) }
            </Skeleton>
          </DetailedInfo.ItemValue>
        </>
      ) }
    </>
  );
};

export default TokenInstanceLPPosition;
