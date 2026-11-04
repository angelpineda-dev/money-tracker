import { portfolioMessages } from '#core/userMessages/portfolio.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { CreateAssetInput, UpdateAssetInput } from '#validators/assets.ts';

const ASSET_OMIT = { createdAt: true, userId: true } as const;

export async function listAssets(userId: string) {
    return prisma.asset.findMany({ where: { userId }, orderBy: { symbol: 'asc' }, omit: ASSET_OMIT });
}

// Assets of other users answer 404, same as missing ones, so ids don't leak ownership.
export async function getAssetById(userId: string, id: number) {
    const asset = await prisma.asset.findFirst({ where: { id, userId }, omit: ASSET_OMIT });
    if (!asset) throw new AppError(portfolioMessages.ASSET_NOT_FOUND, 404);
    return asset;
}

export async function createAsset(userId: string, data: CreateAssetInput) {
    const existing = await prisma.asset.findUnique({ where: { userId_symbol: { userId, symbol: data.symbol } } });
    if (existing) throw new AppError(portfolioMessages.symbolExists(data.symbol), 409);
    return prisma.asset.create({ data: { ...data, userId }, omit: ASSET_OMIT });
}

export async function updateAsset(userId: string, id: number, data: UpdateAssetInput) {
    await getAssetById(userId, id);
    if (data.symbol) {
        const conflict = await prisma.asset.findUnique({
            where: { userId_symbol: { userId, symbol: data.symbol } },
        });
        if (conflict && conflict.id !== id) throw new AppError(portfolioMessages.symbolExists(data.symbol), 409);
    }
    return prisma.asset.update({ where: { id }, data, omit: ASSET_OMIT });
}
