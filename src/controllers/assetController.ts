import type { NextFunction, Request, Response } from 'express';
import AppError from '#errors/AppError.ts';
import { createAsset, listAssets, updateAsset } from '#services/assetService.ts';
import { searchSymbols } from '#services/symbolSearchService.ts';
import { symbolSearchQuerySchema } from '#validators/assets.ts';

export async function getSymbolSearch(req: Request, res: Response, next: NextFunction) {
    try {
        // `validate` only checks the body; the query string is parsed here.
        const parsed = symbolSearchQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((i) => i.message).join(', '), 422);
        }
        const matches = await searchSymbols(parsed.data.q);
        res.json({ success: true, data: matches });
    } catch (e) {
        next(e);
    }
}

export async function getAssets(req: Request, res: Response, next: NextFunction) {
    try {
        const assets = await listAssets(req.user!.id);
        res.json({ success: true, data: assets });
    } catch (e) {
        next(e);
    }
}

export async function postAsset(req: Request, res: Response, next: NextFunction) {
    try {
        const asset = await createAsset(req.user!.id, req.body);
        res.status(201).json({ success: true, data: asset });
    } catch (e) {
        next(e);
    }
}

export async function patchAsset(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const asset = await updateAsset(req.user!.id, id, req.body);
        res.json({ success: true, data: asset });
    } catch (e) {
        next(e);
    }
}
