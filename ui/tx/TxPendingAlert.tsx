import React from 'react';

import { Alert } from 'toolkit/chakra/alert';
import CitreaSpinner from 'ui/shared/CitreaSpinner';

const TxPendingAlert = () => {
  return (
    <Alert startElement={ <CitreaSpinner size={ 20 } my={ 1 } flexShrink={ 0 }/> }>
      This transaction is pending confirmation.
    </Alert>
  );
};

export default TxPendingAlert;
