import express from 'express';
import { login, register, refresh, logoutUser } from '../controllers/authController.ts';
import { validate } from '../middlewares/validate.ts';
import { authLimiter } from '../middlewares/rateLimiter.ts';
import { loginSchema, registerSchema } from '../validators/auth.ts';
import authenticateToken from '../middlewares/authMiddleware.ts';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticateToken, logoutUser);

export default router;
