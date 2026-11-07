import type { CURRENCY } from '#core/constants/currencies.ts';

export type Currency = (typeof CURRENCY)[keyof typeof CURRENCY];
