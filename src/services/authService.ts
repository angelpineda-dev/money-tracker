import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../../generated/prisma/client.ts'
import type { User } from "../types/auth.ts"
import AppError from '../errors/AppError.ts';
import { authMessages } from '../core/userMessages/auth.ts';

const prisma = new PrismaClient();

const registerUser = async (data: User ) => {
    
    const { password, confirmed_password, last_name, ...newData } = data;

    const isPasswordMatch = password === confirmed_password;

    if (!isPasswordMatch || !password || !confirmed_password){
        throw new Error('Confirm your password.')
    }

    const hashedPassword = await bcrypt.hash(password, 15);

    const user = await prisma.users.create({
        data: {
            ...newData,
            password: hashedPassword
        }
    });

    if (!user) {
        throw new AppError('Error while saving user.')
    }
    
    return user;

}

const validateLogin = async (email:string, password:string) => {
    const JWT_SECRET = process.env.JWT_SECRET;
    const errorInvalidCredentials = 'Email or password do not match';
    const user = await prisma.users.findUnique({
        where: { email }
    });

    if (!JWT_SECRET){
        throw new AppError(authMessages.SERVER_MISSING_CONFIG, 500)
    }

    if (!user){
        throw new AppError(errorInvalidCredentials);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if(!isValidPassword){
        throw new AppError(errorInvalidCredentials);
    }

    const token = jwt.sign({
        id: user.id,
        role: user.role
    }, JWT_SECRET, { expiresIn: '4h' })

    return token;
}

export {
    registerUser,
    validateLogin
}