import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../prisma/.env') });
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '#generated/prisma/client.ts';
import { yahooFinanceProvider } from '#quotes/YahooFinanceProvider.ts';

const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.asset.findMany({
        include: {
            transactions: { orderBy: { operatedAt: 'asc' }, take: 1 },
        },
    });

    // Assets are per user: group by symbol so each symbol is fetched once, from
    // the earliest first transaction among the assets that share it.
    const bySymbol = new Map<string, { assetIds: number[]; from: Date }>();
    for (const asset of assets) {
        if (asset.transactions.length === 0) {
            console.log(`[backfill] ${asset.symbol} (asset ${asset.id}) sin transacciones, omitiendo`);
            continue;
        }
        const first = new Date(asset.transactions[0].operatedAt);
        const entry = bySymbol.get(asset.symbol);
        if (entry) {
            entry.assetIds.push(asset.id);
            if (first < entry.from) entry.from = first;
        } else {
            bySymbol.set(asset.symbol, { assetIds: [asset.id], from: first });
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [symbol, { assetIds, from }] of bySymbol) {
        console.log(`[backfill] ${symbol} desde ${from.toISOString().split('T')[0]}`);

        try {
            const bars = await yahooFinanceProvider.getDailyHistory(symbol, from, today);

            for (const assetId of assetIds) {
                for (const bar of bars) {
                    const priceDate = new Date(bar.date);
                    priceDate.setHours(0, 0, 0, 0);

                    await prisma.priceHistory.upsert({
                        where: { assetId_priceDate: { assetId, priceDate } },
                        update: { closePrice: bar.close },
                        create: { assetId, priceDate, closePrice: bar.close },
                    });
                }

                // Actualiza también price_cache con el último precio
                if (bars.length > 0) {
                    const last = bars[bars.length - 1];
                    await prisma.priceCache.upsert({
                        where: { assetId },
                        update: { price: last.close },
                        create: { assetId, price: last.close },
                    });
                }
            }

            console.log(`[backfill] ${symbol} → ${bars.length} precios guardados en ${assetIds.length} activos`);
        } catch (err) {
            console.error(`[backfill] error en ${symbol}:`, err);
        }

        // Pausa entre símbolos para no saturar la API
        await new Promise((r) => setTimeout(r, 1000));
    }

    console.log('[backfill] completado');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
