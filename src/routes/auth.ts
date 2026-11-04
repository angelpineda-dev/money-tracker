import express from 'express';
import { login, logoutAll, logoutUser, refresh, register } from '#controllers/authController.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { authLimiter } from '#middlewares/rateLimiter.ts';
import { validate } from '#middlewares/validate.ts';
import { loginSchema, registerSchema } from '#validators/auth.ts';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticateToken, logoutUser);
router.post('/logout-all', authenticateToken, logoutAll);

export default router;
