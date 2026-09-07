import Router from 'express';
import authtenticateToken from '../middlewares/authMiddleware.ts'
import { PrismaClient } from '../../generated/prisma/client.ts';

const router = Router();
const prisma = new PrismaClient();

router.get('/me', authtenticateToken, async (req, res, next) => {
    const user = req?.user;
   
    try {
        return res.json({
            success: true,
            user: user
        });
    } catch (error: unknown) {
        next(error)
    }
})

export default router;