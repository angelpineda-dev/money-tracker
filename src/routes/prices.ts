import express from "express";
import { postRefreshPrices } from "../controllers/priceController.ts";

const router = express.Router();

router.post("/refresh", postRefreshPrices);

export default router;
