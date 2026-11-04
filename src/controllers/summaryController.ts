import type { NextFunction, Request, Response } from 'express';
import { getPerformanceSeries } from '#services/performanceService.ts';
import { getSummary } from '#services/summaryService.ts';

export async function getSummaryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const from = typeof req.query.from === 'string' ? req.query.from : undefined;
        const to = typeof req.query.to === 'string' ? req.query.to : undefined;
        const data = await getSummary(from, to);
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
}

export async function getPerformanceHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const assetId = Number(req.params.id);
        const from = typeof req.query.from === 'string' ? req.query.from : undefined;
        const to = typeof req.query.to === 'string' ? req.query.to : undefined;
        const data = await getPerformanceSeries(assetId, from, to);
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
}
