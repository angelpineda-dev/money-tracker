import { z } from 'zod';
import { CURRENCIES } from '#core/constants/currencies.ts';
import { portfolioMessages } from '#core/userMessages/portfolio.ts';

export const createAssetSchema = z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
    name: z.string().min(1).max(120),
    currency: z.enum(CURRENCIES),
});

export const updateAssetSchema = z.object({
    symbol: z.string().min(1).max(20).toUpperCase().optional(),
    name: z.string().min(1).max(120).optional(),
    currency: z.enum(CURRENCIES).optional(),
});

export const symbolSearchQuerySchema = z.object({
    q: z
        .string()
        .trim()
        .min(2, portfolioMessages.SYMBOL_QUERY_TOO_SHORT)
        .max(20, portfolioMessages.SYMBOL_QUERY_TOO_LONG),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
