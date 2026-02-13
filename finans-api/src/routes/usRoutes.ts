/**
 * US market routes.
 * GET /api/us/quote, /api/us/quotes, /api/us/chart, /api/us/detail
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getUsQuote, getUsQuotes, getUsChart, getUsDetail } from '../controllers/usController';

const router = Router();

router.get('/quote', asyncHandler(getUsQuote));
router.get('/quotes', asyncHandler(getUsQuotes));
router.get('/chart', asyncHandler(getUsChart));
router.get('/detail', asyncHandler(getUsDetail));

export default router;
