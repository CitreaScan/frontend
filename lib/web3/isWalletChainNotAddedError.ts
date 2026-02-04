import { get } from 'es-toolkit/compat';

import getErrorObj from 'lib/errors/getErrorObj';

const CODE_CHAIN_NOT_ADDED = 4902;

const CODE_PATHS = [ 'code', 'data.code', 'data.originalError.code', 'originalError.code' ] as const;

export default function isWalletChainNotAddedError(error: unknown): boolean {
  const errorObj = getErrorObj(error);
  return CODE_PATHS.some((path) => get(errorObj, path) === CODE_CHAIN_NOT_ADDED);
}
