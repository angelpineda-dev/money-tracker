import express from 'express';
import { login, register } from '../controllers/authController.ts';
// import controller methods

// instance router
const router = express.Router();

// attach routes to router
router.post('/register', register);
router.post('/login', login);

export default router;