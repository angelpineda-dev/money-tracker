import type { Transaction } from '#generated/prisma/client.ts';
import { prisma } from '#lib/prisma.ts';
import {
    calcAverageCost,
    calcInvested,
    calcPerformanceInRange,
    calcPosition,
    isRecentPurchase,
    type PricePoint,
    type TxInput,
} from './calculations.ts';

function toTxInputs(txs: Transaction[]): TxInput[] {
    return txs.map((t) => ({
        type: t.type as 'COMPRA' | 'VENTA',
        operatedAt: new Date(t.operatedAt),
        quantity: Number(t.quantity),
        pricePerShare: Number(t.pricePerShare),
        fees: Number(t.fees),
    }));
}

export async function getSummary(userId: string, fromParam?: string, toParam?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDate = toParam ? new Date(toParam) : today;

    const assets = await prisma.asset.findMany({
        where: { userId },
        include: {
            transactions: { orderBy: { operatedAt: 'asc' } },
            priceCache: true,
            priceHistory: { orderBy: { priceDate: 'asc' } },
        },
        orderBy: { symbol: 'asc' },
    });

    return assets.map((asset) => {
        const txInputs = toTxInputs(asset.transactions);
        const history: PricePoint[] = asset.priceHistory.map((h) => ({
            priceDate: new Date(h.priceDate),
            closePrice: Number(h.closePrice),
        }));

        const firstTxDate =
            txInputs.length > 0
                ? txInputs.reduce((min, t) => (t.operatedAt < min ? t.operatedAt : min), txInputs[0].operatedAt)
                : null;

        const fromDate = fromParam ? new Date(fromParam) : (firstTxDate ?? today);

        const position = calcPosition(txInputs);
        const averageCost = calcAverageCost(txInputs);
        const invested = calcInvested(txInputs);
        const currentPrice = asset.priceCache ? Number(asset.priceCache.price) : null;
        const currentValue = currentPrice !== null ? position * currentPrice : null;

        const { gain, pct } = calcPerformanceInRange(txInputs, history, fromDate, toDate);

        const buys = txInputs.filter((t) => t.type === 'COMPRA');
        const lastBuyDate =
            buys.length > 0
                ? buys.reduce((max, t) => (t.operatedAt > max ? t.operatedAt : max), buys[0].operatedAt)
                : null;

        const boughtThisWeek = isRecentPurchase(txInputs, today);

        const feesInRange = asset.transactions
            .filter((t) => {
                const d = new Date(t.operatedAt);
                return d >= fromDate && d <= toDate;
            })
            .reduce((s, t) => s + Number(t.fees), 0);

        return {
            asset: {
                id: asset.id,
                symbol: asset.symbol,
                name: asset.name,
                currency: asset.currency,
            },
            position,
            averageCost,
            invested,
            currentPrice,
            currentValue,
            gain,
            gainPct: pct,
            firstTransactionDate: firstTxDate?.toISOString().split('T')[0] ?? null,
            lastBuyDate: lastBuyDate?.toISOString().split('T')[0] ?? null,
            boughtThisWeek,
            feesInRange,
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0],
        };
    });
}
