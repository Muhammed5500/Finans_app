/**
 * BIST (Borsa Istanbul) Routes
 * 
 * Provides REST endpoints for BIST market data via Yahoo Finance.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getQuote,
  getQuotes,
  getChart,
  getBistDetail,
} from '../controllers/bistController';

const router = Router();

/**
 * GET /api/bist/quote?symbol=THYAO
 * 
 * Get quote for a single BIST symbol.
 * 
 * @query symbol - Required. BIST symbol (e.g., THYAO or THYAO.IS)
 * 
 * @returns {object} { ok: true, result: { symbol, price, currency, change, changePercent, market, source, fetchedAt } }
 */
router.get('/quote', asyncHandler(getQuote));

/**
 * GET /api/bist/quotes?symbols=THYAO,GARAN,AKBNK
 * 
 * Get quotes for multiple BIST symbols.
 * 
 * @query symbols - Optional. Comma-separated BIST symbols (max 25). 
 *                  Defaults to popular BIST30 stocks if not provided.
 * 
 * @returns {object} { ok: true, result: [...quotes] }
 */
router.get('/quotes', asyncHandler(getQuotes));

/**
 * GET /api/bist/chart?symbol=THYAO&interval=1h&range=5d
 * 
 * Get chart/candle data for a BIST symbol.
 * 
 * @query symbol   - Required. BIST symbol (e.g., THYAO or THYAO.IS)
 * @query interval - Optional. Candle interval (1m, 5m, 15m, 1h, 1d, etc). Default: 1h
 * @query range    - Optional. Data range (1d, 5d, 1mo, 3mo, 1y, etc). Default: 5d
 * 
 * @returns {object} { ok: true, result: { symbol, interval, range, candles, market, source, fetchedAt } }
 */
router.get('/chart', asyncHandler(getChart));

/**
 * GET /api/bist/detail?symbol=THYAO
 * 
 * Get detailed information for a BIST symbol.
 * Includes: company profile, dividend info, key statistics.
 * 
 * @query symbol - Required. BIST symbol (e.g., THYAO or THYAO.IS)
 * 
 * @returns {object} { ok: true, result: { symbol, name, sector, industry, dividend info, statistics, etc. } }
 */
router.get('/detail', asyncHandler(getBistDetail));

export default router;
