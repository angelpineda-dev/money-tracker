import type { Request, Response, NextFunction } from 'express'
import JWT from 'jsonwebtoken';
import AppError from '../errors/AppError.ts';
import { authMessages } from '../core/userMessages/auth.ts';
import type { Roles } from '../types/user.ts';

interface AuthUser {
    id: string;
    role: Roles;
}

function authtenticateToken(req: Request, res: Response, next: NextFunction) {
    const JWT_SECRET = process.env.JWT_SECRET;
    const token = req.header('Authorization')?.split(' ')[1];

    if (!JWT_SECRET){
        throw new AppError(authMessages.SERVER_MISSING_CONFIG, 500);
    }

    if (!token) {
        throw new AppError('Access denied', 401);
    }


    JWT.verify(token, JWT_SECRET, (error, user) => {
        if(error){
            throw new AppError('Invalid token', 403);
        }

        req.user = user as AuthUser;

        next();
    });
}

export default authtenticateToken;