import type { NextFunction, Request, Response } from 'express';
import AppError from '#errors/AppError.ts';
import {
    createTransaction,
    deleteTransaction,
    listTransactions,
    updateTransaction,
} from '#services/transactionService.ts';
import { listTransactionsQuerySchema } from '#validators/transactions.ts';

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = listTransactionsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e) => e.message).join(', ');
            return next(new AppError(msg, 422));
        }
        const txs = await listTransactions(parsed.data);
        res.json({ success: true, data: txs });
    } catch (e) {
        next(e);
    }
}

export async function postTransaction(req: Request, res: Response, next: NextFunction) {
    try {
        const tx = await createTransaction(req.body);
        res.status(201).json({ success: true, data: tx });
    } catch (e) {
        next(e);
    }
}

export async function patchTransaction(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const tx = await updateTransaction(id, req.body);
        res.json({ success: true, data: tx });
    } catch (e) {
        next(e);
    }
}

export async function deleteTransactionHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        await deleteTransaction(id);
        res.json({ success: true, message: 'Operación eliminada' });
    } catch (e) {
        next(e);
    }
}
