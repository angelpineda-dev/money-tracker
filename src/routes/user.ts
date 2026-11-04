import express from 'express';
import {
    changeMyPassword,
    changeRole,
    createTelegramLinkCode,
    deleteMe,
    getMe,
    unlinkTelegram,
    updateMe,
} from '#controllers/userController.ts';
import { ROLE_MANAGERS } from '#core/constants/roles.ts';
import authenticateToken from '#middlewares/authMiddleware.ts';
import { authorize } from '#middlewares/authorize.ts';
import { validate } from '#middlewares/validate.ts';
import { changePasswordSchema, changeRoleSchema, updateProfileSchema } from '#validators/auth.ts';

const router = express.Router();

router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, validate(updateProfileSchema), updateMe);
router.patch('/me/password', authenticateToken, validate(changePasswordSchema), changeMyPassword);
router.delete('/me', authenticateToken, deleteMe);
router.post('/me/telegram/link-code', authenticateToken, createTelegramLinkCode);
router.delete('/me/telegram', authenticateToken, unlinkTelegram);
router.patch('/:id/role', authenticateToken, authorize(...ROLE_MANAGERS), validate(changeRoleSchema), changeRole);

export default router;
