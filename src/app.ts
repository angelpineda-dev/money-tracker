import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../prisma/.env') });
config({ path: resolve(__dirname, '../.env') });

import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler.ts';
import { apiLimiter } from './middlewares/rateLimiter.ts';
import { router } from './routes/index.ts';

const app: Express = express();
const port: number = 3000;

app.use(helmet());
app.use(
    cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
        credentials: true,
    }),
);
app.use(express.json());
app.use(apiLimiter);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'OK' });
});

app.use('/api', router);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

import { createBot } from './bot/bot.ts';
import { startPriceJob } from './jobs/priceJob.ts';
import { startReminderJob } from './jobs/reminderJob.ts';

startPriceJob();

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const bot = createBot();
    startReminderJob((text) => bot.api.sendMessage(process.env.TELEGRAM_CHAT_ID!, text, { parse_mode: 'Markdown' }));
    bot.start().catch((e) => console.error('[bot] error al iniciar:', e));
} else {
    console.log('[bot] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados, bot desactivado');
}
