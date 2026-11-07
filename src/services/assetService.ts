import { portfolioMessages } from '#core/userMessages/portfolio.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { CreateAssetInput, UpdateAssetInput } from '#validators/assets.ts';
import { fetchAndStorePrice } from './priceService.ts';

const ASSET_OMIT = { createdAt: true, userId: true } as const;

/** Asset row plus its cached price; `price` is a Prisma Decimal (string when serialized), so coerce it. */
export function toAssetListItem<T extends { priceCache: { price: { toString(): string } } | null }>(
    asset: T,
): Omit<T, 'priceCache'> & { currentPrice: number | null } {
    const { priceCache, ...rest } = asset;
    return { ...rest, currentPrice: priceCache ? Number(priceCache.price.toString()) : null };
}

export async function listAssets(userId: string) {
    const assets = await prisma.asset.findMany({
        where: { userId },
        orderBy: { symbol: 'asc' },
        omit: ASSET_OMIT,
        include: { priceCache: { select: { price: true } } },
    });
    return assets.map(toAssetListItem);
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
    const asset = await prisma.asset.create({ data: { ...data, userId }, omit: ASSET_OMIT });
    // Fetch the first price now instead of waiting for the weekday cron; failures are swallowed.
    await fetchAndStorePrice(asset);
    return asset;
}

export async function updateAsset(userId: string, id: number, data: UpdateAssetInput) {
    const current = await getAssetById(userId, id);
    if (data.symbol) {
        const conflict = await prisma.asset.findUnique({
            where: { userId_symbol: { userId, symbol: data.symbol } },
        });
        if (conflict && conflict.id !== id) throw new AppError(portfolioMessages.symbolExists(data.symbol), 409);
    }
    const quoteChanged =
        (data.symbol !== undefined && data.symbol !== current.symbol) ||
        (data.currency !== undefined && data.currency !== current.currency);
    if (!quoteChanged) return prisma.asset.update({ where: { id }, data, omit: ASSET_OMIT });

    // Cached price and history belong to the old symbol/currency: drop them and fetch fresh ones.
    const [, , updated] = await prisma.$transaction([
        prisma.priceCache.deleteMany({ where: { assetId: id } }),
        prisma.priceHistory.deleteMany({ where: { assetId: id } }),
        prisma.asset.update({ where: { id }, data, omit: ASSET_OMIT }),
    ]);
    await fetchAndStorePrice(updated);
    return updated;
}
