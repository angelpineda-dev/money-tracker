import express from 'express';
import { getSummaryHandler } from '#controllers/summaryController.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';

const router = express.Router();

// Every route here works on the caller's own portfolio.
router.use(authenticateToken);

router.get('/', getSummaryHandler);

export default router;
