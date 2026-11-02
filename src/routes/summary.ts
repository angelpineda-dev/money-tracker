import express from "express";
import { getSummaryHandler } from "../controllers/summaryController.ts";

const router = express.Router();

router.get("/", getSummaryHandler);

export default router;
