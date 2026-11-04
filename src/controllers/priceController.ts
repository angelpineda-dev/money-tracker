import type { NextFunction, Request, Response } from 'express';
import { refreshPrices } from '#services/priceService.ts';

export async function postRefreshPrices(_req: Request, res: Response, next: NextFunction) {
    try {
        const result = await refreshPrices();
        res.json({ success: true, data: result });
    } catch (e) {
        next(e);
    }
}
