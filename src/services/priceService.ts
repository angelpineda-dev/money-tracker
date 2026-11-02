import { prisma } from "../lib/prisma.ts";
import { yahooFinanceProvider } from "../quotes/YahooFinanceProvider.ts";

export async function refreshPrices(): Promise<{ updated: number }> {
  const assets = await prisma.asset.findMany();
  let updated = 0;

  for (const asset of assets) {
    try {
      const { price, updatedAt } = await yahooFinanceProvider.getLatest(asset.symbol);

      await prisma.priceCache.upsert({
        where: { assetId: asset.id },
        update: { price, updatedAt },
        create: { assetId: asset.id, price, updatedAt },
      });

      // Upsert precio de hoy en el historial
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.priceHistory.upsert({
        where: { assetId_priceDate: { assetId: asset.id, priceDate: today } },
        update: { closePrice: price },
        create: { assetId: asset.id, priceDate: today, closePrice: price },
      });

      updated++;
      console.log(`[prices] ${asset.symbol} → ${price}`);
    } catch (err) {
      console.error(`[prices] error actualizando ${asset.symbol}:`, err);
    }
  }

  return { updated };
}
