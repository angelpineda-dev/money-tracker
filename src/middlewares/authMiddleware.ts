import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken';
import AppError from '../errors/AppError.ts';
import { authMessages } from '../core/userMessages/auth.ts';
import type { Roles } from '../types/user.ts';

interface AuthUser {
    id: number;
    role: Roles;
}

function authenticateToken(req: Request, _res: Response, next: NextFunction) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        return next(new AppError(authMessages.SERVER_MISSING_CONFIG, 500));
    }

    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return next(new AppError('Access denied', 401));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = decoded;
        next();
    } catch {
        next(new AppError('Invalid token', 403));
    }
}

export default authenticateToken;
