import express from "express";
import { validate } from "../middlewares/validate.ts";
import { createAssetSchema, updateAssetSchema } from "../validators/assets.ts";
import { getAssets, postAsset, patchAsset } from "../controllers/assetController.ts";
import { getPerformanceHandler } from "../controllers/summaryController.ts";

const router = express.Router();

router.get("/", getAssets);
router.post("/", validate(createAssetSchema), postAsset);
router.patch("/:id", validate(updateAssetSchema), patchAsset);
router.get("/:id/performance", getPerformanceHandler);

export default router;
