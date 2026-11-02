import express from "express";
import authRouter from "./auth.ts";
import userRouter from "./user.ts";
import assetsRouter from "./assets.ts";
import transactionsRouter from "./transactions.ts";
import summaryRouter from "./summary.ts";
import pricesRouter from "./prices.ts";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/assets", assetsRouter);
router.use("/transactions", transactionsRouter);
router.use("/summary", summaryRouter);
router.use("/prices", pricesRouter);

export { router };