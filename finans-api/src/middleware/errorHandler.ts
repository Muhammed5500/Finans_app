import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Centralized error handler with consistent envelope format
 * { ok: false, error: { code, message } }
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Always log errors for debugging
  console.error('[Error]', err.message, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Generic error
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
    },
  });
}
