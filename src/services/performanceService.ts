import AppError from '#errors/AppError.ts';
import type { Transaction } from '#generated/prisma/client.ts';
import { prisma } from '#lib/prisma.ts';
import { calcInvested, calcPosition, type TxInput } from './calculations.ts';

function toTxInputs(txs: Transaction[]): TxInput[] {
    return txs.map((t) => ({
        type: t.type as 'COMPRA' | 'VENTA',
        operatedAt: new Date(t.operatedAt),
        quantity: Number(t.quantity),
        pricePerShare: Number(t.pricePerShare),
        fees: Number(t.fees),
    }));
}

export async function getPerformanceSeries(assetId: number, fromParam?: string, toParam?: string) {
    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: {
            transactions: { orderBy: { operatedAt: 'asc' } },
            priceHistory: { orderBy: { priceDate: 'asc' } },
        },
    });
    if (!asset) throw new AppError('Activo no encontrado', 404);

    const txInputs = toTxInputs(asset.transactions);
    if (txInputs.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstTxDate = txInputs.reduce((min, t) => (t.operatedAt < min ? t.operatedAt : min), txInputs[0].operatedAt);

    const fromDate = fromParam ? new Date(fromParam) : firstTxDate;
    const toDate = toParam ? new Date(toParam) : today;

    // Build lookup: date string → close price
    const priceMap = new Map<string, number>();
    for (const h of asset.priceHistory) {
        priceMap.set(h.priceDate.toISOString().split('T')[0], Number(h.closePrice));
    }

    // Collect all relevant dates (price history dates within range)
    const historyDates = asset.priceHistory
        .map((h) => new Date(h.priceDate))
        .filter((d) => d >= fromDate && d <= toDate);

    // Add transaction dates too so inflection points are visible
    const txDates = txInputs.map((t) => t.operatedAt).filter((d) => d >= fromDate && d <= toDate);

    const allDates = [...historyDates, ...txDates]
        .map((d) => d.toISOString().split('T')[0])
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort();

    // Helper: get latest price at or before date
    function getPriceAt(dateStr: string): number | null {
        const target = new Date(dateStr).getTime();
        let best: number | null = null;
        for (const h of asset.priceHistory) {
            if (new Date(h.priceDate).getTime() <= target) {
                best = Number(h.closePrice);
            }
        }
        return best;
    }

    return allDates.map((dateStr) => {
        const date = new Date(dateStr);
        const txsUpTo = txInputs.filter((t) => t.operatedAt <= date);
        const position = calcPosition(txsUpTo);
        const invested = calcInvested(txsUpTo);
        const price = getPriceAt(dateStr);
        const value = price !== null ? position * price : null;
        return { date: dateStr, position, value, invested, price };
    });
}
