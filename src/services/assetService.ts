import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { CreateAssetInput, UpdateAssetInput } from '#validators/assets.ts';

const ASSET_OMIT = { createdAt: true } as const;

export async function listAssets() {
    return prisma.asset.findMany({ orderBy: { symbol: 'asc' }, omit: ASSET_OMIT });
}

export async function getAssetById(id: number) {
    const asset = await prisma.asset.findUnique({ where: { id }, omit: ASSET_OMIT });
    if (!asset) throw new AppError('Activo no encontrado', 404);
    return asset;
}

export async function createAsset(data: CreateAssetInput) {
    const existing = await prisma.asset.findUnique({ where: { symbol: data.symbol } });
    if (existing) throw new AppError(`El símbolo ${data.symbol} ya existe`, 409);
    return prisma.asset.create({ data, omit: ASSET_OMIT });
}

export async function updateAsset(id: number, data: UpdateAssetInput) {
    await getAssetById(id);
    if (data.symbol) {
        const conflict = await prisma.asset.findUnique({ where: { symbol: data.symbol } });
        if (conflict && conflict.id !== id) throw new AppError(`El símbolo ${data.symbol} ya está en uso`, 409);
    }
    return prisma.asset.update({ where: { id }, data, omit: ASSET_OMIT });
}
