import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.ts';
import type { UpdateProfileInput, ChangePasswordInput } from '../validators/auth.ts';
import AppError from '../errors/AppError.ts';
import { revokeUserSessions } from './authService.ts';

const PUBLIC_USER_SELECT = {
    email: true,
    name: true,
    role: true
} as const;

const getProfile = async (userId: string) => {
    const user = await prisma.users.findFirst({
        where: { id: userId, active: true },
        select: PUBLIC_USER_SELECT
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    return user;
};

const updateProfile = async (userId: string, data: UpdateProfileInput) => {
    const user = await prisma.users.update({
        where: { id: userId },
        data,
        select: PUBLIC_USER_SELECT
    });

    return user;
};

const changePassword = async (userId: string, sid: number, data: ChangePasswordInput) => {
    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (!user || !user.active) {
        throw new AppError('User not found', 404);
    }

    const isValid = await bcrypt.compare(data.current_password, user.password);
    if (!isValid) {
        throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await bcrypt.hash(data.new_password, 15);

    await prisma.users.update({
        where: { id: userId },
        data: { password: hashedPassword }
    });

    // Optional: log out every other device, keeping the caller's session.
    if (data.close_sessions) {
        await revokeUserSessions(userId, sid);
    }
};

const softDeleteAccount = async (userId: string) => {
    await prisma.users.update({
        where: { id: userId },
        data: { deletedAt: new Date(), active: false }
    });
};

export { getProfile, updateProfile, changePassword, softDeleteAccount };
