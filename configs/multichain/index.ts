import type { MultichainConfig } from 'types/multichain';

import config from 'configs/app';
import type * as MultichainConfigNodejsType from 'configs/multichain/config.nodejs';
import { isBrowser } from 'toolkit/utils/isBrowser';

// Conditional import - only load on server-side
let multichainConfigNodejs: typeof MultichainConfigNodejsType | undefined;
if (typeof window === 'undefined') {
  multichainConfigNodejs = require('configs/multichain/config.nodejs');
}

const multichainConfig: () => MultichainConfig | undefined = () => {
  if (!config.features.opSuperchain.isEnabled) {
    return;
  }

  if (isBrowser()) {
    return window.__multichainConfig;
  }

  return multichainConfigNodejs?.getValue();
};

export default multichainConfig;
