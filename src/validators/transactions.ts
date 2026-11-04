import { z } from 'zod';

const positiveDecimal = z.number().positive();
const nonNegativeDecimal = z.number().min(0);

export const createTransactionSchema = z.object({
    assetId: z.number().int().positive(),
    type: z.enum(['COMPRA', 'VENTA']),
    operatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
    quantity: positiveDecimal,
    pricePerShare: positiveDecimal,
    fees: nonNegativeDecimal.default(0),
    notes: z.string().max(500).optional(),
});

export const updateTransactionSchema = z.object({
    type: z.enum(['COMPRA', 'VENTA']).optional(),
    operatedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido')
        .optional(),
    quantity: positiveDecimal.optional(),
    pricePerShare: positiveDecimal.optional(),
    fees: nonNegativeDecimal.optional(),
    notes: z.string().max(500).optional(),
});

export const listTransactionsQuerySchema = z.object({
    assetId: z.coerce.number().int().positive().optional(),
    type: z.enum(['COMPRA', 'VENTA']).optional(),
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
