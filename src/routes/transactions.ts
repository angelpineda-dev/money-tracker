import express from 'express';
import {
    deleteTransactionHandler,
    getTransactions,
    patchTransaction,
    postTransaction,
} from '#controllers/transactionController.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { validate } from '#middlewares/validate.ts';
import { createTransactionSchema, updateTransactionSchema } from '#validators/transactions.ts';

const router = express.Router();

// Every route here works on the caller's own portfolio.
router.use(authenticateToken);

router.get('/', getTransactions);
router.post('/', validate(createTransactionSchema), postTransaction);
router.patch('/:id', validate(updateTransactionSchema), patchTransaction);
router.delete('/:id', deleteTransactionHandler);

export default router;
