import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UUID_REGEX } from '#core/constants/regex.ts';
import { ROLES } from '#core/constants/roles.ts';
import { authMessages } from '#core/userMessages/auth.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { ReqUser, Roles } from '#types/user.ts';

function isReqUser(payload: unknown): payload is ReqUser {
    if (typeof payload !== 'object' || payload === null) return false;
    const { id, role, sid } = payload as Record<string, unknown>;
    return (
        typeof id === 'string' &&
        UUID_REGEX.test(id) &&
        ROLES.includes(role as Roles) &&
        Number.isInteger(sid) &&
        (sid as number) > 0
    );
}

async function authenticateToken(req: Request, _res: Response, next: NextFunction) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        return next(new AppError(authMessages.SERVER_MISSING_CONFIG, 500));
    }

    const [scheme, token] = req.header('Authorization')?.split(' ') ?? [];

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return next(new AppError('Access denied', 401));
    }

    let decoded: unknown;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return next(new AppError('Token expired', 401));
        }
        return next(new AppError('Invalid token', 401));
    }

    if (!isReqUser(decoded)) {
        return next(new AppError('Invalid token', 401));
    }

    // Session check: logout deletes the refresh_tokens row, which revokes
    // every access token carrying its sid before the JWT's own expiry.
    try {
        const session = await prisma.refreshToken.findUnique({
            where: { id: decoded.sid },
            select: { userId: true, expiresAt: true },
        });
        if (!session || session.userId !== decoded.id || session.expiresAt < new Date()) {
            return next(new AppError('Session revoked', 401));
        }
    } catch (error) {
        return next(error);
    }

    req.user = { id: decoded.id, role: decoded.role, sid: decoded.sid };
    next();
}

export default authenticateToken;
