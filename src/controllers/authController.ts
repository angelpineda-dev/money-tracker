import type { Request, Response } from 'express';
import { registerUser } from '../services/authService.ts';

const register = async (req: Request, res: Response) => {
    try {

    const data = req.body;

    await registerUser(data);

    return res.status(201).send({
        message: 'User registered successfully'
    });
    
    } catch(error) {
        return res.status(400).json({
            error: error.message
        })
    }
};

const login = (req: Request, res: Response) => {
    res.send('User logged in successfully');
};

export { register, login };