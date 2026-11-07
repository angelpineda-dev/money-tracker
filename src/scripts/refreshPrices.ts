import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../prisma/.env') });
config({ path: resolve(__dirname, '../../.env') });

// Manual run of the weekday price cron (src/jobs/priceJob.ts). Imported after dotenv so the
// Prisma client sees DATABASE_URL (static imports would be evaluated before config()).
const { refreshPrices } = await import('#services/priceService.ts');
const { prisma } = await import('#lib/prisma.ts');

try {
    console.log('[prices:refresh] actualizando precios...');
    const { updated } = await refreshPrices();
    console.log(`[prices:refresh] ${updated} activos actualizados`);
} catch (err) {
    console.error('[prices:refresh] error:', err);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
