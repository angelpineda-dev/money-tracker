import type { TRANSACTION_TYPE } from '#core/constants/transactions.ts';

export type TxType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
