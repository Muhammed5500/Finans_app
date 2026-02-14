import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth/authService';
import { AppError } from '../utils/errors';

/**
 * Middleware that verifies JWT from Authorization header
 * and attaches user payload to req.user
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Authorization header missing', 'MISSING_TOKEN');
  }

  const token = header.slice(7);
  const user = verifyToken(token);
  (req as any).user = user;
  next();
}
