import type { NextFunction, Request, Response } from 'express';
import { registerUser, validateLogin, refreshAccessToken, logout } from '../services/authService.ts';

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await registerUser(req.body);
        return res.status(201).json({ success: true, message: 'User registered successfully', data: user });
    } catch (error) {
        next(error);
    }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, refreshToken } = await validateLogin(req.body);
        return res.status(200).json({ success: true, data: { token, refreshToken } });
    } catch (error) {
        next(error);
    }
};

const refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token required' });
        }
        const result = await refreshAccessToken(refreshToken);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await logout(refreshToken);
        }
        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
};

export { register, login, refresh, logoutUser };
