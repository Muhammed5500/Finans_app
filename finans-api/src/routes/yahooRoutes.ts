import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getYahooQuote } from '../controllers/yahooController';

const router = Router();

/**
 * GET /api/yahoo/quote?symbol=GC=F - Generic Yahoo Finance quote
 */
router.get('/quote', asyncHandler(getYahooQuote));

export default router;
