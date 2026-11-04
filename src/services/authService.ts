import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BCRYPT_ROUNDS } from '#core/constants/security.ts';
import { ACCESS_TOKEN_TTL, MAX_ACTIVE_SESSIONS, REFRESH_TOKEN_TTL_MS } from '#core/constants/sessions.ts';
import { authMessages } from '#core/userMessages/auth.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import type { ReqUser } from '#types/user.ts';
import type { LoginInput, RegisterInput } from '#validators/auth.ts';

const registerUser = async (data: RegisterInput): Promise<void> => {
    const { password, confirmed_password: _, ...newData } = data;

    const existing = await prisma.users.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new AppError('Email already in use', 409);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.users.create({
        data: { ...newData, password: hashedPassword },
        select: { id: true },
    });
};

const refreshExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

const signAccessToken = (payload: ReqUser, secret: string) =>
    jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL });

const validateLogin = async (data: LoginInput) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        throw new AppError(authMessages.SERVER_MISSING_CONFIG, 500);
    }

    const errorInvalidCredentials = 'Email or password do not match';

    const user = await prisma.users.findUnique({ where: { email: data.email } });

    if (!user?.active) {
        throw new AppError(errorInvalidCredentials, 401);
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);
    if (!isValidPassword) {
        throw new AppError(errorInvalidCredentials, 401);
    }

    // The refresh_tokens row is the session; its id goes into the JWT as `sid`
    // so authMiddleware can reject access tokens once the session is deleted (logout).
    const refreshToken = randomUUID();
    const session = await prisma.$transaction(async (tx) => {
        // Cleanup: drop this user's expired sessions.
        await tx.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });

        const created = await tx.refreshToken.create({
            data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
        });

        // Cap: keep the newest MAX_ACTIVE_SESSIONS, evict the rest (oldest first).
        const overflow = await tx.refreshToken.findMany({
            where: { userId: user.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: MAX_ACTIVE_SESSIONS,
            select: { id: true },
        });
        if (overflow.length > 0) {
            await tx.refreshToken.deleteMany({ where: { id: { in: overflow.map((s) => s.id) } } });
        }

        return created;
    });

    const token = signAccessToken({ id: user.id, role: user.role, sid: session.id }, JWT_SECRET);

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
    if (!user?.active) {
        throw new AppError('User not found', 401);
    }

    // Rotate in place: swap the token value but keep the row (and so the `sid`).
    // Conditional updateMany + count check makes concurrent refreshes with the same
    // token fail instead of both succeeding, and re-checks expiry atomically.
    const newRefreshToken = randomUUID();
    const { count } = await prisma.refreshToken.updateMany({
        where: { token: refreshToken, expiresAt: { gt: new Date() } },
        data: { token: newRefreshToken, expiresAt: refreshExpiry() },
    });
    if (count === 0) {
        throw new AppError('Invalid or expired refresh token', 401);
    }

    const token = signAccessToken({ id: user.id, role: user.role, sid: stored.id }, JWT_SECRET);

    return { token, refreshToken: newRefreshToken };
};

// Deleting the session revokes its refresh token and, via the sid check in
// authMiddleware, every access token issued for it.
const logout = async (sid: number, userId: string) => {
    await prisma.refreshToken.deleteMany({ where: { id: sid, userId } });
};

// Close all of a user's sessions, optionally keeping one (e.g. the caller's).
const revokeUserSessions = async (userId: string, exceptSid?: number) => {
    const { count } = await prisma.refreshToken.deleteMany({
        where: { userId, ...(exceptSid !== undefined ? { id: { not: exceptSid } } : {}) },
    });
    return count;
};

export { logout, refreshAccessToken, registerUser, revokeUserSessions, validateLogin };
