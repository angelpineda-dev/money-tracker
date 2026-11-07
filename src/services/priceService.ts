import { prisma } from '#lib/prisma.ts';
import { yahooFinanceProvider } from '#quotes/YahooFinanceProvider.ts';

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

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

/** Upserts the cached price and today's history row for one asset. */
async function savePrice(assetId: number, price: number, updatedAt: Date, today: Date): Promise<void> {
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
}

/**
 * Best-effort price for a just-created asset so it doesn't wait for the next cron run.
 * Never throws: a provider failure only leaves the asset without a price.
 */
export async function fetchAndStorePrice(asset: { id: number; symbol: string }): Promise<void> {
    try {
        // One attempt: this runs inside the create-asset request, so no backoff delays.
        const { price, updatedAt } = await yahooFinanceProvider.getLatest(asset.symbol, { maxRetries: 1 });
        await savePrice(asset.id, price, updatedAt, startOfToday());
    } catch (err) {
        console.error(`[prices] no se pudo obtener el precio inicial de ${asset.symbol}:`, err);
    }
}

export async function refreshPrices(): Promise<{ updated: number }> {
    const bySymbol = await assetIdsBySymbol();
    let updated = 0;

    const today = startOfToday();

    for (const [symbol, assetIds] of bySymbol) {
        try {
            const { price, updatedAt } = await yahooFinanceProvider.getLatest(symbol);

            for (const assetId of assetIds) {
                await savePrice(assetId, price, updatedAt, today);
                updated++;
            }

            console.log(`[prices] ${symbol} → ${price} (${assetIds.length} activos)`);
        } catch (err) {
            console.error(`[prices] error actualizando ${symbol}:`, err);
        }
    }

    return { updated };
}
