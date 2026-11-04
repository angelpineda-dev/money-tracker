import express from 'express';
import assetsRouter from './assets.ts';
import authRouter from './auth.ts';
import pricesRouter from './prices.ts';
import summaryRouter from './summary.ts';
import transactionsRouter from './transactions.ts';
import userRouter from './user.ts';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/user', userRouter);
router.use('/assets', assetsRouter);
router.use('/transactions', transactionsRouter);
router.use('/summary', summaryRouter);
router.use('/prices', pricesRouter);

export { router };
