import { chakra } from '@chakra-ui/react';
import React from 'react';

import { isScamToken } from 'lib/token/scam-tokens';
import { Alert } from 'toolkit/chakra/alert';

interface Props {
  tokenAddress: string | undefined;
  isLoading?: boolean;
  className?: string;
}

const ScamTokenWarning = ({ tokenAddress, isLoading, className }: Props) => {
  if (!isScamToken(tokenAddress)) {
    return null;
  }

  return (
    <Alert
      status="error"
      loading={ isLoading }
      className={ className }
      bg="red.600"
      color="white"
    >
      Warning: This token has been flagged as a potential scam.
      It may be impersonating a legitimate token.
      Exercise extreme caution and verify the contract address before interacting.
    </Alert>
  );
};

export default React.memo(chakra(ScamTokenWarning));
