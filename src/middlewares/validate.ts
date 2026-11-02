import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import AppError from '../errors/AppError.ts';

export const validate = (schema: ZodSchema) =>
    (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const message = result.error.issues.map((e: { message: string }) => e.message).join(', ');
            return next(new AppError(message, 422));
        }
        req.body = result.data;
        next();
    };
