import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.ts';
import type { UpdateProfileInput, ChangePasswordInput } from '../validators/auth.ts';
import AppError from '../errors/AppError.ts';

const SAFE_USER_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    active: true,
    createdAt: true,
    updatedAt: true
} as const;

const getProfile = async (userId: number) => {
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: SAFE_USER_SELECT
    });

    if (!user || !user.active) {
        throw new AppError('User not found', 404);
    }

    return user;
};

const updateProfile = async (userId: number, data: UpdateProfileInput) => {
    const user = await prisma.users.update({
        where: { id: userId },
        data,
        select: SAFE_USER_SELECT
    });

    return user;
};

const changePassword = async (userId: number, data: ChangePasswordInput) => {
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
};

const softDeleteAccount = async (userId: number) => {
    await prisma.users.update({
        where: { id: userId },
        data: { deletedAt: new Date(), active: false }
    });
};

export { getProfile, updateProfile, changePassword, softDeleteAccount };
