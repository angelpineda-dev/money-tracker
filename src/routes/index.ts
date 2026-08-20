import express from 'express';
import authRouter from './auth.ts';

// instance router
const router = express.Router();

// attach routes to router
router.use('/auth', authRouter);

export { router };