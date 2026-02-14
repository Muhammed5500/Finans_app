import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/authMiddleware';
import { handleRegister, handleLogin, handleMe } from '../controllers/authController';

const router = Router();

// POST /api/auth/register
router.post('/register', asyncHandler(handleRegister));

// POST /api/auth/login
router.post('/login', asyncHandler(handleLogin));

// GET /api/auth/me (protected)
router.get('/me', requireAuth, asyncHandler(handleMe));

export default router;
