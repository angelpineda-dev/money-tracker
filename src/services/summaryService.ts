import { TRANSACTION_TYPE } from '#core/constants/transactions.ts';
import { prisma } from '#lib/prisma.ts';
import {
    calcAverageCost,
    calcInvested,
    calcPerformanceInRange,
    calcPosition,
    isRecentPurchase,
    type PricePoint,
} from './calculations.ts';
import { toTxInputs } from './txInputs.ts';

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
        const txInputs = toTxInputs(asset.transactions, asset.currency);
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

        const buys = txInputs.filter((t) => t.type === TRANSACTION_TYPE.COMPRA);
        const lastBuyDate =
            buys.length > 0
                ? buys.reduce((max, t) => (t.operatedAt > max ? t.operatedAt : max), buys[0].operatedAt)
                : null;

        const boughtThisWeek = isRecentPurchase(txInputs, today);

        // Commission plus IVA.
        const feesInRange = txInputs
            .filter((t) => t.operatedAt >= fromDate && t.operatedAt <= toDate)
            .reduce((s, t) => s + t.fees + t.iva, 0);

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
