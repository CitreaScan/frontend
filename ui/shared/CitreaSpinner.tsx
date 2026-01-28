import { Box } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';
import Lottie from 'lottie-react';
import React from 'react';

import spinnerAnimation from './citrea-spinner.json';

interface Props extends BoxProps {
  size?: number;
}

const CitreaSpinner = ({ size = 24, ...props }: Props) => {
  return (
    <Box display="inline-block" { ...props }>
      <Lottie
        animationData={ spinnerAnimation }
        loop={ true }
        style={{ width: size, height: size }}
      />
    </Box>
  );
};

export default React.memo(CitreaSpinner);
