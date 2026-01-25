import Lottie from 'lottie-react';
import React from 'react';

import spinnerAnimation from './citrea-spinner.json';

interface Props {
  size?: number;
}

const CitreaSpinner = ({ size = 24 }: Props) => {
  return (
    <Lottie
      animationData={ spinnerAnimation }
      loop={ true }
      style={{ width: size, height: size }}
    />
  );
};

export default React.memo(CitreaSpinner);
