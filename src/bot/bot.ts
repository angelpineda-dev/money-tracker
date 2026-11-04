import { Bot, type CommandContext, type Context, InlineKeyboard } from 'grammy';
import { TRANSACTION_TYPE } from '#core/constants/transactions.ts';
import { assertNever } from '#core/utils/assertNever.ts';
import type { Transaction } from '#generated/prisma/client.ts';
import { prisma } from '#lib/prisma.ts';
import { isRecentPurchase } from '#services/calculations.ts';
import { getSummary } from '#services/summaryService.ts';
import { findUserIdByChatId, linkChat } from '#services/telegramService.ts';
import { createTransaction } from '#services/transactionService.ts';
import type { TxType } from '#types/transaction.ts';

// userId is set by the auth middleware once the chat is linked to an account.
type BotContext = Context & { userId?: string };

// Commands that work before the chat is linked.
const PUBLIC_COMMANDS = new Set(['start', 'link']);

interface PendingTx {
    userId: string;
    type: TxType;
    symbol: string;
    assetId: number;
    quantity: number;
    pricePerShare: number;
    fees: number;
    operatedAt: string;
}

// Almacena transacciones pendientes de confirmación en memoria
const pending = new Map<string, PendingTx>();

// Bot command per transaction type; Record forces an entry for every type.
const TX_COMMAND: Record<TxType, string> = {
    [TRANSACTION_TYPE.COMPRA]: 'compra',
    [TRANSACTION_TYPE.VENTA]: 'venta',
};

// Fees add to the cost of a buy and reduce the proceeds of a sale.
function signedFees(type: TxType, fees: number): number {
    switch (type) {
        case TRANSACTION_TYPE.COMPRA:
            return fees;
        case TRANSACTION_TYPE.VENTA:
            return -fees;
        default:
            return assertNever(type);
    }
}

function parseTxArgs(text: string, type: TxType, userId: string): PendingTx | string {
    const parts = text.trim().split(/\s+/).slice(1);
    if (parts.length < 3) {
        return `Uso: /${TX_COMMAND[type]} SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]`;
    }
    const [symbol, qtyStr, priceStr, feesStr, dateStr] = parts;
    const quantity = parseFloat(qtyStr);
    const pricePerShare = parseFloat(priceStr);
    const fees = feesStr ? parseFloat(feesStr) : 0;
    const today = new Date().toISOString().split('T')[0];
    const operatedAt = dateStr ?? today;

    if (Number.isNaN(quantity) || quantity <= 0) return 'Cantidad inválida';
    if (Number.isNaN(pricePerShare) || pricePerShare <= 0) return 'Precio inválido';
    if (Number.isNaN(fees) || fees < 0) return 'Comisión inválida';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(operatedAt)) return 'Fecha debe ser YYYY-MM-DD';

    return {
        userId,
        type,
        symbol: symbol.toUpperCase(),
        assetId: 0,
        quantity,
        pricePerShare,
        fees,
        operatedAt,
    };
}

function formatMoney(n: number, currency: string) {
    return `${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`;
}

export function createBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

    const bot = new Bot<BotContext>(token);

    // Resuelve el usuario dueño del chat; sin vínculo solo se permiten /start y /link.
    bot.use(async (ctx, next) => {
        const chatId = ctx.chat?.id.toString();
        if (!chatId) return;
        ctx.userId = (await findUserIdByChatId(chatId)) ?? undefined;
        if (ctx.userId) return next();

        const command = ctx.message?.text?.match(/^\/(\w+)/)?.[1];
        if (command && PUBLIC_COMMANDS.has(command)) return next();
        await ctx.reply('Chat no vinculado. Genera un código en la app y envía /link CÓDIGO.');
    });

    // /start
    bot.command('start', async (ctx) => {
        if (ctx.userId) return ctx.reply('Chat vinculado. Usa /compra, /venta, /resumen o /ultima.');
        await ctx.reply('Para vincular tu cuenta genera un código en la app y envía /link CÓDIGO.');
    });

    // /link CÓDIGO
    bot.command('link', async (ctx) => {
        const code = ctx.match.trim();
        if (!code) return ctx.reply('Uso: /link CÓDIGO');
        try {
            const ok = await linkChat(code, ctx.chat.id.toString());
            await ctx.reply(ok ? '✅ Chat vinculado a tu cuenta.' : 'Código inválido o expirado.');
        } catch (e) {
            await ctx.reply('Error al vincular.');
            console.error('[bot] /link error:', e);
        }
    });

    // /compra SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]
    bot.command('compra', async (ctx) => {
        const text = ctx.message?.text ?? '';
        const parsed = parseTxArgs(text, TRANSACTION_TYPE.COMPRA, ctx.userId!);
        if (typeof parsed === 'string') return ctx.reply(parsed);
        await handleTxRequest(ctx, parsed);
    });

    // /venta SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]
    bot.command('venta', async (ctx) => {
        const text = ctx.message?.text ?? '';
        const parsed = parseTxArgs(text, TRANSACTION_TYPE.VENTA, ctx.userId!);
        if (typeof parsed === 'string') return ctx.reply(parsed);
        await handleTxRequest(ctx, parsed);
    });

    // /resumen
    bot.command('resumen', async (ctx) => {
        try {
            const data = await getSummary(ctx.userId!);
            if (data.length === 0) return ctx.reply('Sin activos registrados.');

            const lines = data.map((row) => {
                const gainStr = row.gain >= 0 ? `+${row.gain.toFixed(2)}` : row.gain.toFixed(2);
                const pctStr = row.gainPct !== null ? `(${(row.gainPct * 100).toFixed(2)}%)` : '';
                const flag = row.boughtThisWeek ? ' 🔔' : '';
                return `*${row.asset.symbol}*${flag}\n  Posición: ${row.position} · Precio: ${row.currentPrice ?? '?'} ${row.asset.currency}\n  Valor: ${(row.currentValue ?? 0).toFixed(2)} · Ganancia: ${gainStr} ${pctStr}`;
            });

            await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
        } catch (e) {
            await ctx.reply('Error al obtener resumen.');
            console.error('[bot] /resumen error:', e);
        }
    });

    // /ultima SÍMBOLO
    bot.command('ultima', async (ctx) => {
        const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
        if (parts.length < 2) return ctx.reply('Uso: /ultima SÍMBOLO');
        const symbol = parts[1].toUpperCase();

        try {
            const asset = await prisma.asset.findUnique({
                where: { userId_symbol: { userId: ctx.userId!, symbol } },
            });
            if (!asset) return ctx.reply(`Símbolo ${symbol} no encontrado.`);

            const lastBuy = await prisma.transaction.findFirst({
                where: { assetId: asset.id, type: TRANSACTION_TYPE.COMPRA },
                orderBy: { operatedAt: 'desc' },
            });

            if (!lastBuy) return ctx.reply(`${symbol} no tiene compras registradas.`);

            const date = new Date(lastBuy.operatedAt).toISOString().split('T')[0];
            const total = (Number(lastBuy.quantity) * Number(lastBuy.pricePerShare) + Number(lastBuy.fees)).toFixed(2);
            await ctx.reply(
                `*${symbol}* — última compra\nFecha: ${date}\nCantidad: ${lastBuy.quantity}\nPrecio: ${lastBuy.pricePerShare} ${asset.currency}\nComisión: ${lastBuy.fees}\nTotal: ${total} ${asset.currency}`,
                { parse_mode: 'Markdown' },
            );
        } catch (e) {
            await ctx.reply('Error.');
            console.error('[bot] /ultima error:', e);
        }
    });

    // Confirmación de operación
    bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
        const id = ctx.match[1];
        const tx = pending.get(id);
        pending.delete(id);

        // Pending ops are keyed by a random id; also check it belongs to this chat's user.
        if (!tx || tx.userId !== ctx.userId) {
            await ctx.answerCallbackQuery('Operación expirada.');
            await ctx.editMessageReplyMarkup({ reply_markup: undefined });
            return;
        }

        try {
            await createTransaction(tx.userId, {
                assetId: tx.assetId,
                type: tx.type,
                operatedAt: tx.operatedAt,
                quantity: tx.quantity,
                pricePerShare: tx.pricePerShare,
                fees: tx.fees,
            });
            await ctx.answerCallbackQuery('✅ Guardado');
            await ctx.editMessageText(`✅ ${tx.type} registrada: ${tx.quantity} ${tx.symbol} @ ${tx.pricePerShare}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            await ctx.answerCallbackQuery('Error al guardar');
            await ctx.editMessageText(`❌ Error: ${msg}`);
        }
    });

    bot.callbackQuery(/^cancel:(.+)$/, async (ctx) => {
        const id = ctx.match[1];
        pending.delete(id);
        await ctx.answerCallbackQuery('Cancelado');
        await ctx.editMessageText('❌ Operación cancelada.');
    });

    bot.catch((err) => {
        console.error('[bot] error:', err.message);
    });

    return bot;
}

async function handleTxRequest(ctx: CommandContext<BotContext>, tx: PendingTx) {
    const asset = await prisma.asset.findUnique({
        where: { userId_symbol: { userId: tx.userId, symbol: tx.symbol } },
    });
    if (!asset) {
        return ctx.reply(`Símbolo ${tx.symbol} no encontrado. Agrega el activo primero desde la API.`);
    }
    tx.assetId = asset.id;

    const txs = await prisma.transaction.findMany({ where: { assetId: asset.id } });
    const txInputs = txs.map((t: Transaction) => ({
        type: t.type as TxType,
        operatedAt: new Date(t.operatedAt),
        quantity: Number(t.quantity),
        pricePerShare: Number(t.pricePerShare),
        fees: Number(t.fees),
    }));

    const total = tx.quantity * tx.pricePerShare + signedFees(tx.type, tx.fees);
    const recentWarning =
        tx.type === TRANSACTION_TYPE.COMPRA && isRecentPurchase(txInputs, new Date())
            ? '\n⚠️ *Ya compraste este activo en los últimos 7 días.*'
            : '';

    const msg =
        `*${tx.type}: ${tx.symbol}*\n` +
        `Fecha: ${tx.operatedAt}\n` +
        `Cantidad: ${tx.quantity}\n` +
        `Precio: ${formatMoney(tx.pricePerShare, asset.currency)}\n` +
        `Comisión: ${formatMoney(tx.fees, asset.currency)}\n` +
        `Total: ${formatMoney(total, asset.currency)}` +
        recentWarning +
        '\n\n¿Confirmar?';

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    pending.set(id, tx);

    const keyboard = new InlineKeyboard().text('✅ Confirmar', `confirm:${id}`).text('❌ Cancelar', `cancel:${id}`);

    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
}
