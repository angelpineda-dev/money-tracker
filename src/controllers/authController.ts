import type { NextFunction, Request, Response } from 'express';
import { registerUser, validateLogin } from '../services/authService.ts';

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const data = req.body;

        await registerUser(data);

        return res.status(201).send({
            message: 'User registered successfully'
        });

    } catch (error) {
        next(error);
    }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        const token = await validateLogin(email, password);

        return res.status(200).send(token);

    } catch (error: unknown) {
        next(error);
    }
};

export { register, login };