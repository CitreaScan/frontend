import { ADDRESS } from '@juicedollar/jusd';

import chain from 'configs/app/chain';

const STABLECOIN_PRICE = '1.00';

function getStablecoinAddresses(): Array<string> {
  const chainId = Number(chain.id);
  const addresses = ADDRESS[chainId];

  if (!addresses) {
    return [];
  }

  const stablecoins: Array<string> = [];

  // JUSD stablecoin
  if (addresses.juiceDollar && addresses.juiceDollar !== '0x0000000000000000000000000000000000000000') {
    stablecoins.push(addresses.juiceDollar.toLowerCase());
  }

  // Underlying stablecoins
  if (addresses.startUSD && addresses.startUSD !== '0x0000000000000000000000000000000000000000') {
    stablecoins.push(addresses.startUSD.toLowerCase());
  }
  if (addresses.USDC && addresses.USDC !== '0x0000000000000000000000000000000000000000') {
    stablecoins.push(addresses.USDC.toLowerCase());
  }
  if (addresses.USDT && addresses.USDT !== '0x0000000000000000000000000000000000000000') {
    stablecoins.push(addresses.USDT.toLowerCase());
  }
  if (addresses.CTUSD && addresses.CTUSD !== '0x0000000000000000000000000000000000000000') {
    stablecoins.push(addresses.CTUSD.toLowerCase());
  }

  return stablecoins;
}

const stablecoinAddresses = getStablecoinAddresses();

export function getEffectiveExchangeRate(
  tokenAddress: string | undefined,
  apiExchangeRate: string | null | undefined,
): string | null {
  if (!tokenAddress) {
    return apiExchangeRate ?? null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();

  if (stablecoinAddresses.includes(normalizedAddress)) {
    return STABLECOIN_PRICE;
  }

  return apiExchangeRate ?? null;
}

export function isStablecoin(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) {
    return false;
  }

  return stablecoinAddresses.includes(tokenAddress.toLowerCase());
}
