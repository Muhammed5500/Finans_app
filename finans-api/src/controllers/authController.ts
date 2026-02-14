import { Request, Response } from 'express';
import { register, login, getMe } from '../services/auth/authService';
import { AppError } from '../utils/errors';

function sendSuccess(res: Response, result: unknown): void {
  res.json({ ok: true, result });
}

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
export async function handleRegister(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new AppError(400, 'Email is required', 'MISSING_EMAIL');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new AppError(400, 'Password must be at least 6 characters', 'INVALID_PASSWORD');
  }

  const result = await register(email.trim().toLowerCase(), password, name?.trim());
  res.status(201).json({ ok: true, result });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function handleLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    throw new AppError(400, 'Email is required', 'MISSING_EMAIL');
  }
  if (!password || typeof password !== 'string') {
    throw new AppError(400, 'Password is required', 'MISSING_PASSWORD');
  }

  const result = await login(email.trim().toLowerCase(), password);
  sendSuccess(res, result);
}

/**
 * GET /api/auth/me
 * Requires Authorization: Bearer <token>
 */
export async function handleMe(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    throw new AppError(401, 'Authorization required', 'UNAUTHORIZED');
  }

  const result = await getMe(user.id);
  sendSuccess(res, result);
}
