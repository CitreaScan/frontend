import { chakra } from '@chakra-ui/react';
import React from 'react';

import { route } from 'nextjs-routes';

import config from 'configs/app';
import { useColorModeValue } from 'toolkit/chakra/color-mode';
import { Image } from 'toolkit/chakra/image';
import IconSvg from 'ui/shared/IconSvg';

interface Props {
  isCollapsed?: boolean;
  onClick?: (event: React.SyntheticEvent) => void;
  className?: string;
}

const LogoFallback = ({ isCollapsed, isSmall }: { isCollapsed?: boolean; isSmall?: boolean }) => {
  const display = isSmall ? {
    base: 'none',
    lg: isCollapsed === false ? 'none' : 'block',
    xl: isCollapsed ? 'block' : 'none',
  } : {
    base: 'block',
    lg: isCollapsed === false ? 'block' : 'none',
    xl: isCollapsed ? 'none' : 'block',
  };

  return (
    <IconSvg
      name={ isSmall ? 'networks/icon-placeholder' : 'networks/logo-placeholder' }
      width={ isSmall ? '30px' : '120px' }
      height="100%"
      color={{ base: 'orange.600', _dark: 'white' }}
      display={ display }
      aria-label={ isSmall ? 'Network icon placeholder' : 'Network logo placeholder' }
    />
  );
};

const NetworkLogo = ({ isCollapsed, onClick, className }: Props) => {

  const logoSrc = useColorModeValue('/assets/citrea-logo-light.svg', '/assets/citrea-logo-dark.svg');
  const iconSrc = useColorModeValue('/assets/citrea-icon-light.svg', '/assets/citrea-icon-dark.svg');

  return (
    <chakra.a
      className={ className }
      href={ route({ pathname: '/' }) }
      width={{ base: '120px', lg: isCollapsed === false ? '120px' : '30px', xl: isCollapsed ? '30px' : '120px' }}
      height={{ base: '24px', lg: isCollapsed === false ? '24px' : '30px', xl: isCollapsed ? '30px' : '24px' }}
      display="inline-flex"
      overflow="hidden"
      onClick={ onClick }
      flexShrink={ 0 }
      aria-label="Link to main page"
    >
      { /* big logo */ }
      <Image
        w="100%"
        h="100%"
        src={ logoSrc }
        alt={ `${ config.chain.name } network logo` }
        fallback={ <LogoFallback isCollapsed={ isCollapsed }/> }
        display={{ base: 'block', lg: isCollapsed === false ? 'block' : 'none', xl: isCollapsed ? 'none' : 'block' }}
        objectFit="contain"
        objectPosition="left"
      />
      { /* small logo */ }
      <Image
        w="100%"
        h="100%"
        src={ iconSrc }
        alt={ `${ config.chain.name } network icon` }
        fallback={ <LogoFallback isCollapsed={ isCollapsed } isSmall/> }
        display={{ base: 'none', lg: isCollapsed === false ? 'none' : 'block', xl: isCollapsed ? 'block' : 'none' }}
        objectFit="contain"
        objectPosition="left"
      />
    </chakra.a>
  );
};

export default React.memo(chakra(NetworkLogo));
