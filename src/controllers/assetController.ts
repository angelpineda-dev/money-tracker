import type { NextFunction, Request, Response } from 'express';
import { createAsset, listAssets, updateAsset } from '#services/assetService.ts';

export async function getAssets(_req: Request, res: Response, next: NextFunction) {
    try {
        const assets = await listAssets();
        res.json({ success: true, data: assets });
    } catch (e) {
        next(e);
    }
}

export async function postAsset(req: Request, res: Response, next: NextFunction) {
    try {
        const asset = await createAsset(req.body);
        res.status(201).json({ success: true, data: asset });
    } catch (e) {
        next(e);
    }
}

export async function patchAsset(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const asset = await updateAsset(id, req.body);
        res.json({ success: true, data: asset });
    } catch (e) {
        next(e);
    }
}
