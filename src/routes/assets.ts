import express from 'express';
import { getAssets, patchAsset, postAsset } from '#controllers/assetController.ts';
import { getPerformanceHandler } from '#controllers/summaryController.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { validate } from '#middlewares/validate.ts';
import { createAssetSchema, updateAssetSchema } from '#validators/assets.ts';

const router = express.Router();

// Every route here works on the caller's own portfolio.
router.use(authenticateToken);

router.get('/', getAssets);
router.post('/', validate(createAssetSchema), postAsset);
router.patch('/:id', validate(updateAssetSchema), patchAsset);
router.get('/:id/performance', getPerformanceHandler);

export default router;
