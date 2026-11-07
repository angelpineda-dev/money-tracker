import { ivaOnFees } from '#core/constants/tax.ts';
import type { Transaction } from '#generated/prisma/client.ts';
import type { TxType } from '#types/transaction.ts';
import type { TxInput } from './calculations.ts';

/** Prisma rows to calculation inputs; `iva` derives from the asset's currency. */
export function toTxInputs(txs: Transaction[], currency: string): TxInput[] {
    return txs.map((t) => {
        const fees = Number(t.fees);
        return {
            type: t.type as TxType,
            operatedAt: new Date(t.operatedAt),
            quantity: Number(t.quantity),
            pricePerShare: Number(t.pricePerShare),
            fees,
            iva: ivaOnFees(currency, fees),
        };
    });
}
