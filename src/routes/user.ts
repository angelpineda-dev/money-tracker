import express from 'express';
import authenticateToken from '../middlewares/authMiddleware.ts';
import { validate } from '../middlewares/validate.ts';
import { updateProfileSchema, changePasswordSchema } from '../validators/auth.ts';
import { getMe, updateMe, changeMyPassword, deleteMe } from '../controllers/userController.ts';

const router = express.Router();

router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, validate(updateProfileSchema), updateMe);
router.patch('/me/password', authenticateToken, validate(changePasswordSchema), changeMyPassword);
router.delete('/me', authenticateToken, deleteMe);

export default router;
