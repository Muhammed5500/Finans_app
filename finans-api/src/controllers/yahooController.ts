/**
 * Yahoo Controller
 *
 * Generic Yahoo Finance quote endpoint — no BIST validation.
 * Works for forex (=X), futures (=F), ETFs, and any Yahoo symbol.
 */

import { Request, Response } from 'express';
import { getYahooService } from '../services/yahoo';
import { AppError } from '../utils/errors';

/**
 * GET /api/yahoo/quote?symbol=GC=F
 */
export async function getYahooQuote(req: Request, res: Response): Promise<void> {
  const symbol = req.query.symbol as string;
  if (!symbol) {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_SYMBOL');
  }

  const service = getYahooService();
  const result = await service.getGenericQuote(symbol);

  res.json({
    ok: true,
    result,
  });
}
