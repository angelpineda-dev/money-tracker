import { portfolioMessages } from '#core/userMessages/portfolio.ts';
import AppError from '#errors/AppError.ts';
import type { Transaction } from '#generated/prisma/client.ts';
import { prisma } from '#lib/prisma.ts';
import type {
    CreateTransactionInput,
    ListTransactionsQuery,
    UpdateTransactionInput,
} from '#validators/transactions.ts';
import { getAssetById } from './assetService.ts';
import { calcPosition, validateSell } from './calculations.ts';

const TX_INCLUDE = { asset: { select: { symbol: true, currency: true } } } as const;
const TX_OMIT = { createdAt: true } as const;

function toTxInputs(txs: Transaction[]) {
    return txs.map((t) => ({
        type: t.type as 'COMPRA' | 'VENTA',
        operatedAt: new Date(t.operatedAt),
        quantity: Number(t.quantity),
        pricePerShare: Number(t.pricePerShare),
        fees: Number(t.fees),
    }));
}

export async function listTransactions(userId: string, query: ListTransactionsQuery) {
    const where: Record<string, unknown> = { asset: { userId } };
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
        orderBy: [{ assetId: 'asc' }, { operatedAt: 'asc' }],
        include: TX_INCLUDE,
        omit: TX_OMIT,
    });
}

export async function createTransaction(userId: string, data: CreateTransactionInput) {
    await getAssetById(userId, data.assetId);

    if (data.type === 'VENTA') {
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
        include: TX_INCLUDE,
        omit: TX_OMIT,
    });
}

// Owner is reached through the asset; other users' transactions answer 404.
async function getOwnedTransaction(userId: string, id: number) {
    const tx = await prisma.transaction.findFirst({ where: { id, asset: { userId } } });
    if (!tx) throw new AppError(portfolioMessages.TRANSACTION_NOT_FOUND, 404);
    return tx;
}

export async function updateTransaction(userId: string, id: number, data: UpdateTransactionInput) {
    const tx = await getOwnedTransaction(userId, id);

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
    const hypothetical = [
        ...toTxInputs(others),
        {
            type: merged.type as 'COMPRA' | 'VENTA',
            operatedAt: merged.operatedAt,
            quantity: merged.quantity,
            pricePerShare: merged.pricePerShare,
            fees: merged.fees,
        },
    ];
    if (calcPosition(hypothetical) < 0) {
        throw new AppError('La edición dejaría la posición en negativo', 400);
    }

    return prisma.transaction.update({
        where: { id },
        data: merged,
        include: TX_INCLUDE,
        omit: TX_OMIT,
    });
}

export async function deleteTransaction(userId: string, id: number) {
    const tx = await getOwnedTransaction(userId, id);

    const others = await prisma.transaction.findMany({
        where: { assetId: tx.assetId, id: { not: id } },
    });
    if (calcPosition(toTxInputs(others)) < 0) {
        throw new AppError('Eliminar esta operación dejaría la posición en negativo', 400);
    }

    await prisma.transaction.delete({ where: { id } });
}
