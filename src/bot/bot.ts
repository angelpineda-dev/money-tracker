import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../lib/prisma.ts";
import { createTransaction } from "../services/transactionService.ts";
import { getSummary } from "../services/summaryService.ts";
import { isRecentPurchase } from "../services/calculations.ts";
import type { Transaction } from "../../generated/prisma/client.ts";

type TxType = "COMPRA" | "VENTA";

interface PendingTx {
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

function parseTxArgs(text: string, type: TxType): PendingTx | string {
  const parts = text.trim().split(/\s+/).slice(1);
  if (parts.length < 3) {
    const cmd = type === "COMPRA" ? "compra" : "venta";
    return `Uso: /${cmd} SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]`;
  }
  const [symbol, qtyStr, priceStr, feesStr, dateStr] = parts;
  const quantity = parseFloat(qtyStr);
  const pricePerShare = parseFloat(priceStr);
  const fees = feesStr ? parseFloat(feesStr) : 0;
  const today = new Date().toISOString().split("T")[0];
  const operatedAt = dateStr ?? today;

  if (isNaN(quantity) || quantity <= 0) return "Cantidad inválida";
  if (isNaN(pricePerShare) || pricePerShare <= 0) return "Precio inválido";
  if (isNaN(fees) || fees < 0) return "Comisión inválida";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operatedAt)) return "Fecha debe ser YYYY-MM-DD";

  return {
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
  return `${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`;
}

export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado");
  if (!allowedChatId) throw new Error("TELEGRAM_CHAT_ID no configurado");

  const bot = new Bot(token);

  // Solo responde al chat configurado
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id.toString() !== allowedChatId) return;
    await next();
  });

  // /compra SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]
  bot.command("compra", async (ctx) => {
    const text = ctx.message?.text ?? "";
    const parsed = parseTxArgs(text, "COMPRA");
    if (typeof parsed === "string") return ctx.reply(parsed);
    await handleTxRequest(ctx, parsed);
  });

  // /venta SÍMBOLO CANTIDAD PRECIO [COMISIÓN] [FECHA]
  bot.command("venta", async (ctx) => {
    const text = ctx.message?.text ?? "";
    const parsed = parseTxArgs(text, "VENTA");
    if (typeof parsed === "string") return ctx.reply(parsed);
    await handleTxRequest(ctx, parsed);
  });

  // /resumen
  bot.command("resumen", async (ctx) => {
    try {
      const data = await getSummary();
      if (data.length === 0) return ctx.reply("Sin activos registrados.");

      const lines = data.map((row) => {
        const gainStr = row.gain >= 0 ? `+${row.gain.toFixed(2)}` : row.gain.toFixed(2);
        const pctStr = row.gainPct !== null ? `(${(row.gainPct * 100).toFixed(2)}%)` : "";
        const flag = row.boughtThisWeek ? " 🔔" : "";
        return `*${row.asset.symbol}*${flag}\n  Posición: ${row.position} · Precio: ${row.currentPrice ?? "?"} ${row.asset.currency}\n  Valor: ${(row.currentValue ?? 0).toFixed(2)} · Ganancia: ${gainStr} ${pctStr}`;
      });

      await ctx.reply(lines.join("\n\n"), { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.reply("Error al obtener resumen.");
      console.error("[bot] /resumen error:", e);
    }
  });

  // /ultima SÍMBOLO
  bot.command("ultima", async (ctx) => {
    const parts = (ctx.message?.text ?? "").trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply("Uso: /ultima SÍMBOLO");
    const symbol = parts[1].toUpperCase();

    try {
      const asset = await prisma.asset.findUnique({ where: { symbol } });
      if (!asset) return ctx.reply(`Símbolo ${symbol} no encontrado.`);

      const lastBuy = await prisma.transaction.findFirst({
        where: { assetId: asset.id, type: "COMPRA" },
        orderBy: { operatedAt: "desc" },
      });

      if (!lastBuy) return ctx.reply(`${symbol} no tiene compras registradas.`);

      const date = new Date(lastBuy.operatedAt).toISOString().split("T")[0];
      const total = (Number(lastBuy.quantity) * Number(lastBuy.pricePerShare) + Number(lastBuy.fees)).toFixed(2);
      await ctx.reply(
        `*${symbol}* — última compra\nFecha: ${date}\nCantidad: ${lastBuy.quantity}\nPrecio: ${lastBuy.pricePerShare} ${asset.currency}\nComisión: ${lastBuy.fees}\nTotal: ${total} ${asset.currency}`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      await ctx.reply("Error.");
      console.error("[bot] /ultima error:", e);
    }
  });

  // Confirmación de operación
  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const tx = pending.get(id);
    pending.delete(id);

    if (!tx) {
      await ctx.answerCallbackQuery("Operación expirada.");
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      return;
    }

    try {
      await createTransaction({
        assetId: tx.assetId,
        type: tx.type,
        operatedAt: tx.operatedAt,
        quantity: tx.quantity,
        pricePerShare: tx.pricePerShare,
        fees: tx.fees,
      });
      await ctx.answerCallbackQuery("✅ Guardado");
      await ctx.editMessageText(
        `✅ ${tx.type} registrada: ${tx.quantity} ${tx.symbol} @ ${tx.pricePerShare}`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      await ctx.answerCallbackQuery("Error al guardar");
      await ctx.editMessageText(`❌ Error: ${msg}`);
    }
  });

  bot.callbackQuery(/^cancel:(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    pending.delete(id);
    await ctx.answerCallbackQuery("Cancelado");
    await ctx.editMessageText("❌ Operación cancelada.");
  });

  bot.catch((err) => {
    console.error("[bot] error:", err.message);
  });

  return bot;
}

async function handleTxRequest(ctx: Parameters<Parameters<Bot["command"]>[1]>[0], tx: PendingTx) {
  const asset = await prisma.asset.findUnique({ where: { symbol: tx.symbol } });
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

  const total = tx.quantity * tx.pricePerShare + (tx.type === "COMPRA" ? tx.fees : -tx.fees);
  const recentWarning =
    tx.type === "COMPRA" && isRecentPurchase(txInputs, new Date())
      ? "\n⚠️ *Ya compraste este activo en los últimos 7 días.*"
      : "";

  const msg =
    `*${tx.type}: ${tx.symbol}*\n` +
    `Fecha: ${tx.operatedAt}\n` +
    `Cantidad: ${tx.quantity}\n` +
    `Precio: ${formatMoney(tx.pricePerShare, asset.currency)}\n` +
    `Comisión: ${formatMoney(tx.fees, asset.currency)}\n` +
    `Total: ${formatMoney(total, asset.currency)}` +
    recentWarning +
    "\n\n¿Confirmar?";

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  pending.set(id, tx);

  const keyboard = new InlineKeyboard()
    .text("✅ Confirmar", `confirm:${id}`)
    .text("❌ Cancelar", `cancel:${id}`);

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard });
}
