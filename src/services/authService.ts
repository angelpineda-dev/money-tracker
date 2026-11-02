import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.ts';
import type { RegisterInput, LoginInput } from '../validators/auth.ts';
import AppError from '../errors/AppError.ts';
import { authMessages } from '../core/userMessages/auth.ts';

const SAFE_USER_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    active: true,
    createdAt: true,
    updatedAt: true
} as const;

const registerUser = async (data: RegisterInput) => {
    const { password, confirmed_password: _, ...newData } = data;

    const existing = await prisma.users.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new AppError('Email already in use', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 15);

    const user = await prisma.users.create({
        data: { ...newData, password: hashedPassword },
        select: SAFE_USER_SELECT
    });

    return user;
};

const validateLogin = async (data: LoginInput) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new AppError(authMessages.SERVER_MISSING_CONFIG, 500);
    }

    const errorInvalidCredentials = 'Email or password do not match';

    const user = await prisma.users.findUnique({ where: { email: data.email } });

    if (!user || !user.active) {
        throw new AppError(errorInvalidCredentials, 401);
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
        throw new AppError(errorInvalidCredentials, 401);
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt }
    });

    return { token, refreshToken };
};

const refreshAccessToken = async (refreshToken: string) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new AppError(authMessages.SERVER_MISSING_CONFIG, 500);
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.expiresAt < new Date()) {
        throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.users.findUnique({ where: { id: stored.userId } });
    if (!user || !user.active) {
        throw new AppError('User not found', 401);
    }

    const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
    );

    return { token };
};

const logout = async (refreshToken: string) => {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
};

export { registerUser, validateLogin, refreshAccessToken, logout };
