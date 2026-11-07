import { ivaOnFees } from '#core/constants/tax.ts';
import { TRANSACTION_TYPE } from '#core/constants/transactions.ts';
import { portfolioMessages } from '#core/userMessages/portfolio.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { TxType } from '#types/transaction.ts';
import type {
    CreateTransactionInput,
    ListTransactionsQuery,
    UpdateTransactionInput,
} from '#validators/transactions.ts';
import { getAssetById } from './assetService.ts';
import { calcPosition, validateSell } from './calculations.ts';
import { toTxInputs } from './txInputs.ts';

const TX_INCLUDE = { asset: { select: { symbol: true, currency: true } } } as const;
const TX_OMIT = { createdAt: true } as const;

/** Adds the derived `iva` (16% of the commission, MXN only) so clients don't repeat the rule. */
function withIva<T extends { fees: { toString(): string }; asset: { currency: string } }>(tx: T) {
    return { ...tx, iva: ivaOnFees(tx.asset.currency, Number(tx.fees.toString())) };
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
    const txs = await prisma.transaction.findMany({
        where,
        orderBy: [{ assetId: 'asc' }, { operatedAt: 'asc' }],
        include: TX_INCLUDE,
        omit: TX_OMIT,
    });
    return txs.map(withIva);
}

export async function createTransaction(userId: string, data: CreateTransactionInput) {
    const asset = await getAssetById(userId, data.assetId);

    if (data.type === TRANSACTION_TYPE.VENTA) {
        const existing = await prisma.transaction.findMany({ where: { assetId: data.assetId } });
        validateSell(toTxInputs(existing, asset.currency), data.quantity);
    }

    const created = await prisma.transaction.create({
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
    return withIva(created);
}

// Owner is reached through the asset; other users' transactions answer 404.
async function getOwnedTransaction(userId: string, id: number) {
    const tx = await prisma.transaction.findFirst({ where: { id, asset: { userId } }, include: TX_INCLUDE });
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
        ...toTxInputs(others, tx.asset.currency),
        {
            type: merged.type as TxType,
            operatedAt: merged.operatedAt,
            quantity: merged.quantity,
            pricePerShare: merged.pricePerShare,
            fees: merged.fees,
            iva: ivaOnFees(tx.asset.currency, merged.fees),
        },
    ];
    if (calcPosition(hypothetical) < 0) {
        throw new AppError('La edición dejaría la posición en negativo', 400);
    }

    const updated = await prisma.transaction.update({
        where: { id },
        data: merged,
        include: TX_INCLUDE,
        omit: TX_OMIT,
    });
    return withIva(updated);
}

export async function deleteTransaction(userId: string, id: number) {
    const tx = await getOwnedTransaction(userId, id);

    const others = await prisma.transaction.findMany({
        where: { assetId: tx.assetId, id: { not: id } },
    });
    if (calcPosition(toTxInputs(others, tx.asset.currency)) < 0) {
        throw new AppError('Eliminar esta operación dejaría la posición en negativo', 400);
    }

    await prisma.transaction.delete({ where: { id } });
}
