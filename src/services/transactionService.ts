import { prisma } from "../lib/prisma.ts";
import AppError from "../errors/AppError.ts";
import { calcPosition, validateSell } from "./calculations.ts";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
} from "../validators/transactions.ts";
import type { Transaction } from "../../generated/prisma/client.ts";

function toTxInputs(txs: Transaction[]) {
  return txs.map((t) => ({
    type: t.type as "COMPRA" | "VENTA",
    operatedAt: new Date(t.operatedAt),
    quantity: Number(t.quantity),
    pricePerShare: Number(t.pricePerShare),
    fees: Number(t.fees),
  }));
}

export async function listTransactions(query: ListTransactionsQuery) {
  const where: Record<string, unknown> = {};
  if (query.assetId) where.assetId = query.assetId;
  if (query.type) where.type = query.type;
  if (query.from || query.to) {
    where.operatedAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
  return prisma.transaction.findMany({
    where,
    orderBy: [{ assetId: "asc" }, { operatedAt: "asc" }],
    include: { asset: { select: { symbol: true, currency: true } } },
  });
}

export async function createTransaction(data: CreateTransactionInput) {
  const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
  if (!asset) throw new AppError("Activo no encontrado", 404);

  if (data.type === "VENTA") {
    const existing = await prisma.transaction.findMany({ where: { assetId: data.assetId } });
    validateSell(toTxInputs(existing), data.quantity);
  }

  return prisma.transaction.create({
    data: {
      assetId: data.assetId,
      type: data.type,
      operatedAt: new Date(data.operatedAt),
      quantity: data.quantity,
      pricePerShare: data.pricePerShare,
      fees: data.fees,
      notes: data.notes,
    },
    include: { asset: { select: { symbol: true, currency: true } } },
  });
}

export async function updateTransaction(id: number, data: UpdateTransactionInput) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) throw new AppError("Operación no encontrada", 404);

  const merged = {
    type: data.type ?? tx.type,
    operatedAt: data.operatedAt ? new Date(data.operatedAt) : tx.operatedAt,
    quantity: data.quantity ?? Number(tx.quantity),
    pricePerShare: data.pricePerShare ?? Number(tx.pricePerShare),
    fees: data.fees ?? Number(tx.fees),
    notes: data.notes !== undefined ? data.notes : tx.notes,
  };

  // Re-validate position after hypothetical edit
  const others = await prisma.transaction.findMany({
    where: { assetId: tx.assetId, id: { not: id } },
  });
  const hypothetical = [...toTxInputs(others), {
    type: merged.type as "COMPRA" | "VENTA",
    operatedAt: merged.operatedAt,
    quantity: merged.quantity,
    pricePerShare: merged.pricePerShare,
    fees: merged.fees,
  }];
  if (calcPosition(hypothetical) < 0) {
    throw new AppError("La edición dejaría la posición en negativo", 400);
  }

  return prisma.transaction.update({
    where: { id },
    data: merged,
    include: { asset: { select: { symbol: true, currency: true } } },
  });
}

export async function deleteTransaction(id: number) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) throw new AppError("Operación no encontrada", 404);

  const others = await prisma.transaction.findMany({
    where: { assetId: tx.assetId, id: { not: id } },
  });
  if (calcPosition(toTxInputs(others)) < 0) {
    throw new AppError("Eliminar esta operación dejaría la posición en negativo", 400);
  }

  await prisma.transaction.delete({ where: { id } });
}
