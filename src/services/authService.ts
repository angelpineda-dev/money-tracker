import bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma/client.ts'
import type { User } from "../types/authInterface.ts"

const prisma = new PrismaClient();

const registerUser = async (data: User ) => {
    
    const { password, confirmed_password, last_name, ...newData } = data;

    const isPasswordMatch = password === confirmed_password;

    if (!isPasswordMatch){
        throw new Error('Error confirming password.')
    }

    const hashedPassword = await bcrypt.hash(password, 15);

    const user = await prisma.users.create({
        data: {
            ...newData,
            password: hashedPassword
        }
    });

    if (!user) {
        throw new Error('Error while saving user.')
    }
    
    return user;

}

export {
    registerUser
}