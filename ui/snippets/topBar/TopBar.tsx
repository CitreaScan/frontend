import { Flex, Separator, Box } from '@chakra-ui/react';
import React from 'react';

import config from 'configs/app';
import { CONTENT_MAX_WIDTH } from 'ui/shared/layout/utils';

import DeFiDropdown from './DeFiDropdown';
import NetworkMenu from './NetworkMenu';
import Settings from './settings/Settings';
import TopBarStats from './TopBarStats';

const TopBar = () => {
  return (
    // Citrea brand orange top banner
    <Box
      bgColor={{ _light: 'orange.600', _dark: 'orange.700' }}
      position="sticky"
      left={ 0 }
      width="100%"
      maxWidth="100vw"
      color="white"
    >
      <Flex
        py={ 2 }
        px={{ base: 3, lg: 6 }}
        m="0 auto"
        justifyContent="space-between"
        alignItems="center"
        maxW={ `${ CONTENT_MAX_WIDTH }px` }
      >
        { !config.features.opSuperchain.isEnabled ? <TopBarStats/> : <div/> }
        <Flex alignItems="center">
          { config.features.deFiDropdown.isEnabled && (
            <>
              <DeFiDropdown/>
              <Separator mr={ 3 } ml={{ base: 2, sm: 3 }} height={ 4 } orientation="vertical" borderColor="whiteAlpha.400"/>
            </>
          ) }
          <Settings/>
          { Boolean(config.UI.featuredNetworks.items) && (
            <>
              <Separator mx={ 3 } height={ 4 } orientation="vertical" borderColor="whiteAlpha.400"/>
              <NetworkMenu/>
            </>
          ) }
        </Flex>
      </Flex>
    </Box>
  );
};

export default React.memo(TopBar);
