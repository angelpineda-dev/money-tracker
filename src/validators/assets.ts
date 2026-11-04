import { z } from 'zod';

export const createAssetSchema = z.object({
    symbol: z.string().min(1).max(20).toUpperCase(),
    name: z.string().min(1).max(120),
    currency: z.enum(['MXN', 'USD']),
});

export const updateAssetSchema = z.object({
    symbol: z.string().min(1).max(20).toUpperCase().optional(),
    name: z.string().min(1).max(120).optional(),
    currency: z.enum(['MXN', 'USD']).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
