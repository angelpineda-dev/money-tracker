import { prisma } from '#lib/prisma.ts';
import { yahooFinanceProvider } from '#quotes/YahooFinanceProvider.ts';

// Assets are per user, so one symbol can have several rows. Group asset ids by
// symbol so each symbol is fetched from the provider once.
async function assetIdsBySymbol(): Promise<Map<string, number[]>> {
    const assets = await prisma.asset.findMany({ select: { id: true, symbol: true } });
    const bySymbol = new Map<string, number[]>();
    for (const { id, symbol } of assets) {
        bySymbol.set(symbol, [...(bySymbol.get(symbol) ?? []), id]);
    }
    return bySymbol;
}

export async function refreshPrices(): Promise<{ updated: number }> {
    const bySymbol = await assetIdsBySymbol();
    let updated = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [symbol, assetIds] of bySymbol) {
        try {
            const { price, updatedAt } = await yahooFinanceProvider.getLatest(symbol);

            for (const assetId of assetIds) {
                await prisma.priceCache.upsert({
                    where: { assetId },
                    update: { price, updatedAt },
                    create: { assetId, price, updatedAt },
                });

                // Upsert precio de hoy en el historial
                await prisma.priceHistory.upsert({
                    where: { assetId_priceDate: { assetId, priceDate: today } },
                    update: { closePrice: price },
                    create: { assetId, priceDate: today, closePrice: price },
                });
                updated++;
            }

            console.log(`[prices] ${symbol} → ${price} (${assetIds.length} activos)`);
        } catch (err) {
            console.error(`[prices] error actualizando ${symbol}:`, err);
        }
    }

    return { updated };
}
