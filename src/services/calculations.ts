import { TRANSACTION_TYPE } from '#core/constants/transactions.ts';
import { assertNever } from '#core/utils/assertNever.ts';
import type { TxType } from '#types/transaction.ts';

export interface TxInput {
    type: TxType;
    operatedAt: Date;
    quantity: number;
    pricePerShare: number;
    fees: number;
    /** IVA on `fees`; 0 for non-MXN assets. */
    iva: number;
}

export interface PricePoint {
    priceDate: Date;
    closePrice: number;
}

export interface PerformanceResult {
    /** null when a held position has no price at the start or end of the range, so the gain is unknown. */
    gain: number | null;
    pct: number | null;
}

export function calcPosition(txs: TxInput[]): number {
    return txs.reduce((acc, tx) => {
        switch (tx.type) {
            case TRANSACTION_TYPE.COMPRA:
                return acc + tx.quantity;
            case TRANSACTION_TYPE.VENTA:
                return acc - tx.quantity;
            default:
                return assertNever(tx.type);
        }
    }, 0);
}

export function calcAverageCost(txs: TxInput[]): number {
    const buys = txs.filter((t) => t.type === TRANSACTION_TYPE.COMPRA);
    const totalQty = buys.reduce((s, t) => s + t.quantity, 0);
    if (totalQty === 0) return 0;
    const totalCost = buys.reduce((s, t) => s + t.quantity * t.pricePerShare + t.fees + t.iva, 0);
    return totalCost / totalQty;
}

export function calcInvested(txs: TxInput[]): number {
    return txs.reduce((acc, tx) => {
        switch (tx.type) {
            case TRANSACTION_TYPE.COMPRA:
                return acc + tx.quantity * tx.pricePerShare + tx.fees + tx.iva;
            case TRANSACTION_TYPE.VENTA:
                return acc - (tx.quantity * tx.pricePerShare - tx.fees - tx.iva);
            default:
                return assertNever(tx.type);
        }
    }, 0);
}

export function isRecentPurchase(txs: TxInput[], today: Date): boolean {
    const buys = txs.filter((t) => t.type === TRANSACTION_TYPE.COMPRA);
    if (buys.length === 0) return false;
    const lastBuy = buys.reduce((latest, t) => (t.operatedAt > latest.operatedAt ? t : latest));
    const diffMs = today.getTime() - lastBuy.operatedAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays < 7;
}

export function validateSell(txs: TxInput[], sellQty: number): void {
    const current = calcPosition(txs);
    if (current - sellQty < 0) {
        throw new Error(`Venta inválida: posición actual ${current}, intento vender ${sellQty}`);
    }
}

function getPriceAt(history: PricePoint[], date: Date): number | null {
    const dateMs = date.getTime();
    const candidates = history
        .filter((h) => h.priceDate.getTime() <= dateMs)
        .sort((a, b) => b.priceDate.getTime() - a.priceDate.getTime());
    return candidates.length > 0 ? candidates[0].closePrice : null;
}

function positionAt(txs: TxInput[], date: Date): number {
    const before = txs.filter((t) => t.operatedAt.getTime() <= date.getTime());
    return calcPosition(before);
}

export function calcPerformanceInRange(txs: TxInput[], history: PricePoint[], from: Date, to: Date): PerformanceResult {
    const firstOpDate =
        txs.length > 0 ? txs.reduce((min, t) => (t.operatedAt < min ? t.operatedAt : min), txs[0].operatedAt) : null;

    const isDefaultFrom = firstOpDate !== null && from.getTime() === firstOpDate.getTime();

    const priceAtTo = getPriceAt(history, to);
    const priceAtFrom = getPriceAt(history, from);

    const qtyAtTo = positionAt(txs, to);
    const qtyAtFrom = positionAt(txs, from);

    // A missing price only matters while shares are held: treating it as 0 would invent a total loss.
    const needsStartPrice = !isDefaultFrom && qtyAtFrom > 0;
    if ((qtyAtTo > 0 && priceAtTo === null) || (needsStartPrice && priceAtFrom === null)) {
        return { gain: null, pct: null };
    }

    const valorFinal = qtyAtTo * (priceAtTo ?? 0);
    const valorInicio = needsStartPrice ? qtyAtFrom * (priceAtFrom ?? 0) : 0;

    const rangoTxs = txs.filter((t) => t.operatedAt >= from && t.operatedAt <= to);

    // Gross of commissions and IVA, like the broker's gain; fees are reported separately.
    const comprasRango = rangoTxs
        .filter((t) => t.type === TRANSACTION_TYPE.COMPRA)
        .reduce((s, t) => s + t.quantity * t.pricePerShare, 0);

    const ventasRango = rangoTxs
        .filter((t) => t.type === TRANSACTION_TYPE.VENTA)
        .reduce((s, t) => s + t.quantity * t.pricePerShare, 0);

    const gain = valorFinal + ventasRango - valorInicio - comprasRango;
    const base = valorInicio + comprasRango;
    const pct = base !== 0 ? gain / base : null;

    return { gain, pct };
}
