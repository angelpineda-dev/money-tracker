import type { Request, Response, NextFunction } from 'express';
import type { Roles } from '../types/user.ts';
import AppError from '../errors/AppError.ts';

export const authorize = (...roles: Roles[]) =>
    (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new AppError('Insufficient permissions', 403));
        }
        next();
    };
