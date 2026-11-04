import bcrypt from 'bcrypt';
import { UUID_REGEX } from '#core/constants/regex.ts';
import { userMessages } from '#core/userMessages/user.ts';
import AppError from '#errors/AppError.ts';
import { prisma } from '#lib/prisma.ts';
import { outranks, type ReqUser } from '#types/user.ts';
import type { ChangePasswordInput, ChangeRoleInput, UpdateProfileInput } from '#validators/auth.ts';
import { revokeUserSessions } from './authService.ts';

const PUBLIC_USER_SELECT = {
    email: true,
    name: true,
    role: true,
} as const;

const getProfile = async (userId: string) => {
    const user = await prisma.users.findFirst({
        where: { id: userId, active: true },
        select: PUBLIC_USER_SELECT,
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
        select: PUBLIC_USER_SELECT,
    });

    return user;
};

const changePassword = async (userId: string, sid: number, data: ChangePasswordInput) => {
    const user = await prisma.users.findUnique({ where: { id: userId } });

    if (!user?.active) {
        throw new AppError('User not found', 404);
    }

    const isValid = await bcrypt.compare(data.current_password, user.password);
    if (!isValid) {
        throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await bcrypt.hash(data.new_password, 15);

    await prisma.users.update({
        where: { id: userId },
        data: { password: hashedPassword },
    });

    // Optional: log out every other device, keeping the caller's session.
    if (data.close_sessions) {
        await revokeUserSessions(userId, sid);
    }
};

const softDeleteAccount = async (userId: string) => {
    await prisma.users.update({
        where: { id: userId },
        data: { deletedAt: new Date(), active: false },
    });
};

// Hierarchy rules (route already restricts callers to ROLE_MANAGERS):
// - nobody changes their own role (avoids self-escalation or locking out the last admin);
// - the target must rank strictly below the actor (ADMIN can't touch ADMIN/SUPER_ADMIN);
// - the new role can't rank above the actor (ADMIN can't grant SUPER_ADMIN).
const changeUserRole = async (actor: ReqUser, targetId: string, { role }: ChangeRoleInput) => {
    if (!UUID_REGEX.test(targetId)) {
        throw new AppError(userMessages.INVALID_USER_ID, 400);
    }
    if (actor.id === targetId) {
        throw new AppError(userMessages.CANNOT_CHANGE_OWN_ROLE, 403);
    }

    const target = await prisma.users.findFirst({
        where: { id: targetId, active: true },
        select: { role: true },
    });
    if (!target) {
        throw new AppError(userMessages.USER_NOT_FOUND, 404);
    }
    if (!outranks(actor.role, target.role)) {
        throw new AppError(userMessages.CANNOT_MANAGE_TARGET, 403);
    }
    if (outranks(role, actor.role)) {
        throw new AppError(userMessages.CANNOT_ASSIGN_ROLE, 403);
    }

    const user = await prisma.users.update({
        where: { id: targetId },
        data: { role },
        select: PUBLIC_USER_SELECT,
    });

    // The role lives in the JWT, so close the target's sessions: otherwise their
    // current access tokens keep the old role until they expire.
    if (target.role !== role) {
        await revokeUserSessions(targetId);
    }

    return user;
};

export { changePassword, changeUserRole, getProfile, softDeleteAccount, updateProfile };
