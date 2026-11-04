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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const asset of assets) {
        if (asset.transactions.length === 0) {
            console.log(`[backfill] ${asset.symbol} sin transacciones, omitiendo`);
            continue;
        }

        const from = new Date(asset.transactions[0].operatedAt);
        console.log(`[backfill] ${asset.symbol} desde ${from.toISOString().split('T')[0]}`);

        try {
            const bars = await yahooFinanceProvider.getDailyHistory(asset.symbol, from, today);
            let inserted = 0;

            for (const bar of bars) {
                const priceDate = new Date(bar.date);
                priceDate.setHours(0, 0, 0, 0);

                await prisma.priceHistory.upsert({
                    where: { assetId_priceDate: { assetId: asset.id, priceDate } },
                    update: { closePrice: bar.close },
                    create: { assetId: asset.id, priceDate, closePrice: bar.close },
                });
                inserted++;
            }

            console.log(`[backfill] ${asset.symbol} → ${inserted} precios guardados`);

            // Actualiza también price_cache con el último precio
            if (bars.length > 0) {
                const last = bars[bars.length - 1];
                await prisma.priceCache.upsert({
                    where: { assetId: asset.id },
                    update: { price: last.close },
                    create: { assetId: asset.id, price: last.close },
                });
            }
        } catch (err) {
            console.error(`[backfill] error en ${asset.symbol}:`, err);
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
