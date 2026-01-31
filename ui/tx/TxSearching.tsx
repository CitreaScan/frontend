import { Flex } from '@chakra-ui/react';
import React from 'react';

import CitreaSpinner from 'ui/shared/CitreaSpinner';

const TxSearching = () => {
  return (
    <Flex direction="column" align="center" justify="center" py={ 12 }>
      <CitreaSpinner size={ 48 }/>
    </Flex>
  );
};

export default React.memo(TxSearching);
