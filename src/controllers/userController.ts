import type { NextFunction, Request, Response } from 'express';
import { userMessages } from '#core/userMessages/user.ts';
import { changePassword, changeUserRole, getProfile, softDeleteAccount, updateProfile } from '#services/userService.ts';

const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await getProfile(req.user!.id);
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

const updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await updateProfile(req.user!.id, req.body);
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

const changeMyPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await changePassword(req.user!.id, req.user!.sid, req.body);
        return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        next(error);
    }
};

const deleteMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await softDeleteAccount(req.user!.id);
        return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const changeRole = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
        const user = await changeUserRole(req.user!, req.params.id, req.body);
        return res.status(200).json({ success: true, message: userMessages.ROLE_UPDATED, data: user });
    } catch (error) {
        next(error);
    }
};

export { changeMyPassword, changeRole, deleteMe, getMe, updateMe };
