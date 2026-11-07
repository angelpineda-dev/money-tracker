// Currencies an asset can be quoted in. `Asset.currency` is a plain String column, so this
// object is the single source: validators and services derive from it.
export const CURRENCY = {
    MXN: 'MXN',
    USD: 'USD',
} as const;

/** Tuple form for `z.enum` and `includes` checks. */
export const CURRENCIES = [CURRENCY.MXN, CURRENCY.USD] as const;
