import express from 'express';
import { changeMyPassword, deleteMe, getMe, updateMe } from '#controllers/userController.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { validate } from '#middlewares/validate.ts';
import { changePasswordSchema, updateProfileSchema } from '#validators/auth.ts';

const router = express.Router();

router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, validate(updateProfileSchema), updateMe);
router.patch('/me/password', authenticateToken, validate(changePasswordSchema), changeMyPassword);
router.delete('/me', authenticateToken, deleteMe);

export default router;
