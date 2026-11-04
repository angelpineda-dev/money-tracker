import express from 'express';
import { postRefreshPrices } from '#controllers/priceController.ts';
import { ROLE_MANAGERS } from '#core/constants/roles.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { authorize } from '#middlewares/authorize.ts';

const router = express.Router();

// Refresh is global (every user's assets) and calls the quote provider: admins only.
router.post('/refresh', authenticateToken, authorize(...ROLE_MANAGERS), postRefreshPrices);

export default router;
