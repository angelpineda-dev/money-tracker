import cron from 'node-cron';
import { TRANSACTION_TYPE } from '#core/constants/transactions.ts';
import type { Transaction } from '#generated/prisma/client.ts';
import { prisma } from '#lib/prisma.ts';
import { isRecentPurchase } from '#services/calculations.ts';
import type { TxType } from '#types/transaction.ts';

type TxInput = { type: TxType; operatedAt: Date; quantity: number; pricePerShare: number; fees: number };

function toTxInputs(txs: Transaction[]): TxInput[] {
    return txs.map((t) => ({
        type: t.type as TxType,
        operatedAt: new Date(t.operatedAt),
        quantity: Number(t.quantity),
        pricePerShare: Number(t.pricePerShare),
        fees: Number(t.fees),
    }));
}

export function startReminderJob(sendMessage: (chatId: string, text: string) => Promise<void>) {
    cron.schedule(
        '0 9 * * *',
        async () => {
            console.log('[reminderJob] verificando compras recientes...');
            const today = new Date();

            // Only assets whose owner is active and has linked a Telegram chat.
            const assets = await prisma.asset.findMany({
                where: { user: { active: true, telegramChatId: { not: null } } },
                include: {
                    transactions: { orderBy: { operatedAt: 'asc' } },
                    user: { select: { telegramChatId: true } },
                },
            });

            for (const asset of assets) {
                const chatId = asset.user.telegramChatId;
                if (!chatId) continue;
                const txInputs = toTxInputs(asset.transactions);
                if (!isRecentPurchase(txInputs, today)) continue;

                const buys = txInputs.filter((t) => t.type === TRANSACTION_TYPE.COMPRA);
                const lastBuyDate = buys.reduce(
                    (max, t) => (t.operatedAt > max ? t.operatedAt : max),
                    buys[0].operatedAt,
                );

                const alreadySent = await prisma.reminderLog.findFirst({
                    where: {
                        assetId: asset.id,
                        type: 'recent_purchase',
                        sentAt: { gt: lastBuyDate },
                    },
                });

                if (alreadySent) continue;

                const dateStr = lastBuyDate.toISOString().split('T')[0];
                try {
                    await sendMessage(chatId, `🔔 *${asset.symbol}*: compraste el ${dateStr} (hace menos de 7 días)`);
                    await prisma.reminderLog.create({
                        data: { assetId: asset.id, type: 'recent_purchase' },
                    });
                    console.log(`[reminderJob] recordatorio enviado para ${asset.symbol}`);
                } catch (e) {
                    console.error(`[reminderJob] error enviando recordatorio para ${asset.symbol}:`, e);
                }
            }
        },
        { timezone: 'America/Mexico_City' },
    );
    console.log('[reminderJob] cron registrado (diario 9:00 CT)');
}
