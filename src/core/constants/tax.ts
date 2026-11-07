import { CURRENCY } from './currencies.ts';

/** IVA charged by Mexican brokers on the commission. */
export const IVA_RATE = 0.16;

/** IVA on a commission: only MXN operations pay it. Unrounded; round when displaying. */
export function ivaOnFees(currency: string, fees: number): number {
    return currency === CURRENCY.MXN ? fees * IVA_RATE : 0;
}
