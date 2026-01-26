import { Flex, useToken } from '@chakra-ui/react';
import type { UseQueryResult } from '@tanstack/react-query';
import React from 'react';

import type { Address } from 'types/api/address';
import type { TokenInfo } from 'types/api/token';
import type { EntityTag } from 'ui/shared/EntityTags/types';

import config from 'configs/app';
import useAddressMetadataInfoQuery from 'lib/address/useAddressMetadataInfoQuery';
import type { ResourceError } from 'lib/api/resources';
import useApiQuery from 'lib/api/useApiQuery';
import { useMultichainContext } from 'lib/contexts/multichain';
import { getTokenTypeName } from 'lib/token/tokenTypes';
import { useLaunchpadTokenImage } from 'lib/token/useLaunchpadTokenImage';
import { Link } from 'toolkit/chakra/link';
import { Tooltip } from 'toolkit/chakra/tooltip';
import AddressAlerts from 'ui/address/details/AddressAlerts';
import AddressQrCode from 'ui/address/details/AddressQrCode';
import AccountActionsMenu from 'ui/shared/AccountActionsMenu/AccountActionsMenu';
import AddressAddToWallet from 'ui/shared/address/AddressAddToWallet';
import AddressEntity from 'ui/shared/entities/address/AddressEntity';
import * as TokenEntity from 'ui/shared/entities/token/TokenEntity';
import EntityTags from 'ui/shared/EntityTags/EntityTags';
import formatUserTags from 'ui/shared/EntityTags/formatUserTags';
import sortEntityTags from 'ui/shared/EntityTags/sortEntityTags';
import IconSvg from 'ui/shared/IconSvg';
import NetworkExplorers from 'ui/shared/NetworkExplorers';
import PageTitle from 'ui/shared/Page/PageTitle';

import TokenVerifiedInfo from './TokenVerifiedInfo';

const PREDEFINED_TAG_PRIORITY = 100;

interface Props {
  tokenQuery: UseQueryResult<TokenInfo, ResourceError<unknown>>;
  addressQuery: UseQueryResult<Address, ResourceError<unknown>>;
  hash: string;
}

const TokenPageTitle = ({ tokenQuery, addressQuery, hash }: Props) => {
  const multichainContext = useMultichainContext();
  const addressHash = !tokenQuery.isPlaceholderData ? (tokenQuery.data?.address_hash || '') : '';

  const verifiedInfoQuery = useApiQuery('contractInfo:token_verified_info', {
    pathParams: { hash: addressHash, chainId: config.chain.id },
    queryOptions: { enabled: Boolean(tokenQuery.data) && !tokenQuery.isPlaceholderData && config.features.verifiedTokens.isEnabled },
  });

  // Fetch launchpad token data - always fetch, we'll use it only if no icon_url
  const launchpadQuery = useLaunchpadTokenImage(hash);
  const launchpadData = launchpadQuery.data;

  // Token with launchpad image fallback
  const tokenWithImage = React.useMemo(() => {
    if (!tokenQuery.data) {
      return undefined;
    }
    if (tokenQuery.data.icon_url) {
      return tokenQuery.data;
    }
    if (launchpadData?.imageUrl) {
      return {
        ...tokenQuery.data,
        icon_url: launchpadData.imageUrl,
      };
    }
    return tokenQuery.data;
  }, [ tokenQuery.data, launchpadData?.imageUrl ]);

  const addressesForMetadataQuery = React.useMemo(() => ([ hash ].filter(Boolean)), [ hash ]);
  const addressMetadataQuery = useAddressMetadataInfoQuery(addressesForMetadataQuery);

  const isLoading = tokenQuery.isPlaceholderData ||
    addressQuery.isPlaceholderData ||
    (config.features.verifiedTokens.isEnabled && verifiedInfoQuery.isPending);

  const tokenSymbolText = tokenQuery.data?.symbol ? ` (${ tokenQuery.data.symbol })` : '';

  const [ bridgedTokenTagBgColor ] = useToken('colors', 'blue.500');
  const [ bridgedTokenTagTextColor ] = useToken('colors', 'white');

  const tags: Array<EntityTag> = React.useMemo(() => {
    return [
      tokenQuery.data ? {
        slug: tokenQuery.data?.type,
        name: getTokenTypeName(tokenQuery.data.type),
        tagType: 'custom' as const,
        ordinal: PREDEFINED_TAG_PRIORITY,
      } : undefined,
      config.features.bridgedTokens.isEnabled && tokenQuery.data?.is_bridged ?
        {
          slug: 'bridged',
          name: 'Bridged',
          tagType: 'custom' as const,
          ordinal: PREDEFINED_TAG_PRIORITY,
          meta: { bgColor: bridgedTokenTagBgColor, textColor: bridgedTokenTagTextColor },
        } :
        undefined,
      ...formatUserTags(addressQuery.data),
      verifiedInfoQuery.data?.projectSector ?
        { slug: verifiedInfoQuery.data.projectSector, name: verifiedInfoQuery.data.projectSector, tagType: 'custom' as const, ordinal: -30 } :
        undefined,
      ...(addressMetadataQuery.data?.addresses?.[hash.toLowerCase()]?.tags.filter(tag => tag.tagType !== 'note') || []),
    ].filter(Boolean).sort(sortEntityTags);
  }, [
    addressMetadataQuery.data?.addresses,
    addressQuery.data,
    bridgedTokenTagBgColor,
    bridgedTokenTagTextColor,
    tokenQuery.data,
    verifiedInfoQuery.data?.projectSector,
    hash,
  ]);

  const contentAfter = (
    <>
      { tokenQuery.data && <TokenEntity.Reputation value={ tokenQuery.data.reputation } ml={ 0 }/> }
      { verifiedInfoQuery.data?.tokenAddress && (
        <Tooltip content={ `Information on this token has been verified by ${ config.chain.name }` }>
          <IconSvg name="certified" color="green.500" boxSize={ 6 } cursor="pointer"/>
        </Tooltip>
      ) }
      <EntityTags
        isLoading={ isLoading || (config.features.addressMetadata.isEnabled && addressMetadataQuery.isPending) }
        tags={ tags }
        addressHash={ addressQuery.data?.hash }
        flexGrow={ 1 }
      />
    </>
  );

  const secondRow = (
    <Flex alignItems="center" w="100%" minW={ 0 } columnGap={ 2 } rowGap={ 2 } flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
      { addressQuery.data && (
        <AddressEntity
          address={{ ...addressQuery.data, name: '' }}
          isLoading={ isLoading }
          variant="subheading"
          icon={ multichainContext?.chain ? {
            shield: { name: 'pie_chart', isLoading },
          } : undefined }
        />
      ) }
      { !isLoading && tokenWithImage && <AddressAddToWallet token={ tokenWithImage } variant="button"/> }
      { addressQuery.data && <AddressQrCode hash={ addressQuery.data.hash } isLoading={ isLoading }/> }
      <AccountActionsMenu isLoading={ isLoading }/>
      <Flex ml={{ base: 0, lg: 'auto' }} columnGap={ 2 } flexGrow={{ base: 1, lg: 0 }}>
        <TokenVerifiedInfo verifiedInfoQuery={ verifiedInfoQuery }/>
        <NetworkExplorers type="token" pathParam={ addressHash } ml={{ base: 'auto', lg: 0 }}/>
      </Flex>
    </Flex>
  );

  const tokenIconElement = React.useMemo(() => {
    if (!tokenWithImage) {
      return null;
    }

    const icon = (
      <TokenEntity.Icon
        token={ tokenWithImage }
        isLoading={ tokenQuery.isPlaceholderData }
        variant="heading"
        chain={ multichainContext?.chain }
      />
    );

    // Only show link if we're using the launchpad image (token has no own icon_url)
    if (launchpadData?.launchpadUrl && !tokenQuery.data?.icon_url) {
      return (
        <Link href={ launchpadData.launchpadUrl } target="_blank" rel="noopener noreferrer">
          { icon }
        </Link>
      );
    }

    return icon;
  }, [ tokenWithImage, tokenQuery.data?.icon_url, tokenQuery.isPlaceholderData, multichainContext?.chain, launchpadData?.launchpadUrl ]);

  return (
    <>
      <PageTitle
        title={ `${ tokenQuery.data?.name || 'Unnamed token' }${ tokenSymbolText }` }
        isLoading={ tokenQuery.isPlaceholderData }
        beforeTitle={ tokenIconElement }
        contentAfter={ contentAfter }
        secondRow={ secondRow }
      />
      { !addressMetadataQuery.isPending && (
        <AddressAlerts
          tags={ addressMetadataQuery.data?.addresses?.[hash.toLowerCase()]?.tags }
          isScamToken={ tokenQuery.data?.reputation === 'scam' }
        />
      ) }
    </>
  );
};

export default TokenPageTitle;
