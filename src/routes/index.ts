import express from 'express';
import authRouter from './auth.ts';
import userRouter from './user.ts';

// instance router
const router = express.Router();

// attach routes to router
router.use('/auth', authRouter);
router.use('/user', userRouter)

export { router };