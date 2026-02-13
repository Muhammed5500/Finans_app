/**
 * BIST (Borsa Istanbul) Controller
 * 
 * Handles REST endpoints for BIST market data via Yahoo Finance.
 */

import { Request, Response } from 'express';
import {
  getYahooService,
  isValidYahooRange,
  YAHOO_RANGES,
  YahooFinanceError,
  // New interval helpers
  SUPPORTED_INTERVALS,
  isSupportedInterval,
  type SupportedInterval,
} from '../services/yahoo';
import { AppError } from '../utils/errors';
import {
  isValidBistSymbol,
  getBaseSymbol,
  getBaseSymbols,
} from '../utils/symbols';
import {
  BIST_DEFAULT_SYMBOLS,
  BIST_DEFAULT_INTERVAL,
  BIST_DEFAULT_RANGE,
  MAX_SYMBOLS_PER_REQUEST,
} from '../config/bist';

// Singleton service instance
const yahooService = getYahooService();

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

/**
 * Send success response with consistent envelope
 */
function sendSuccess(res: Response, result: unknown): void {
  res.json({ ok: true, result });
}

/**
 * Convert YahooFinanceError to AppError
 */
function handleYahooError(error: unknown): never {
  if (error instanceof YahooFinanceError) {
    const statusMap: Record<string, number> = {
      INVALID_SYMBOL: 400,
      SYMBOL_NOT_FOUND: 404,
      INVALID_INTERVAL: 400,
      INVALID_RANGE: 400,
      RATE_LIMIT: 429,
      PROVIDER_THROTTLED: 429,  // Treat throttling as rate limit
      NETWORK_ERROR: 503,
      VALIDATION_ERROR: 400,
      PROVIDER_ERROR: 502,
    };

    const status = statusMap[error.code] || 500;
    throw new AppError(status, error.message, error.code);
  }

  if (error instanceof AppError) {
    throw error;
  }

  throw new AppError(500, (error as Error).message, 'INTERNAL_ERROR');
}

/**
 * Validate symbol parameter
 */
function validateSymbol(rawSymbol: string): void {
  if (!isValidBistSymbol(rawSymbol)) {
    throw new AppError(
      400,
      `Invalid BIST symbol: "${rawSymbol}". Must be 3-6 uppercase letters (e.g., THYAO, GARAN)`,
      'INVALID_SYMBOL'
    );
  }
}

// -----------------------------------------------------------------------------
// CONTROLLERS
// -----------------------------------------------------------------------------

/**
 * GET /api/bist/quote?symbol=THYAO
 * 
 * Get quote for a single BIST symbol.
 * Accepts: THYAO or THYAO.IS
 */
export async function getQuote(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  // Validate required parameter
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const baseSymbol = getBaseSymbol(rawSymbol);

  // Validate symbol format
  validateSymbol(baseSymbol);

  try {
    const result = await yahooService.getQuote(baseSymbol);
    sendSuccess(res, result);
  } catch (error) {
    handleYahooError(error);
  }
}

/**
 * GET /api/bist/quotes?symbols=THYAO,GARAN,AKBNK
 * 
 * Get quotes for multiple BIST symbols.
 * If symbols not provided, returns default list.
 * Max 25 symbols per request.
 */
export async function getQuotes(req: Request, res: Response): Promise<void> {
  const { symbols } = req.query;

  let symbolList: string[];

  if (!symbols || typeof symbols !== 'string' || symbols.trim() === '') {
    // Use default list
    symbolList = [...BIST_DEFAULT_SYMBOLS];
  } else {
    // Parse and validate symbols
    symbolList = getBaseSymbols(symbols);

    if (symbolList.length === 0) {
      symbolList = [...BIST_DEFAULT_SYMBOLS];
    }

    // Check max limit
    if (symbolList.length > MAX_SYMBOLS_PER_REQUEST) {
      throw new AppError(
        400,
        `Too many symbols. Maximum ${MAX_SYMBOLS_PER_REQUEST} symbols per request, got ${symbolList.length}`,
        'TOO_MANY_SYMBOLS'
      );
    }

    // Validate each symbol
    const invalidSymbols: string[] = [];
    symbolList.forEach((sym) => {
      if (!isValidBistSymbol(sym)) {
        invalidSymbols.push(sym);
      }
    });

    if (invalidSymbols.length > 0) {
      throw new AppError(
        400,
        `Invalid symbol(s): ${invalidSymbols.join(', ')}. Each must be 3-6 uppercase letters.`,
        'INVALID_SYMBOL'
      );
    }
  }

  try {
    const results = await yahooService.getQuotes(symbolList);
    sendSuccess(res, results);
  } catch (error) {
    handleYahooError(error);
  }
}

/**
 * GET /api/bist/chart?symbol=THYAO&interval=1h&range=5d
 * 
 * Get chart/candle data for a BIST symbol.
 * 
 * Supported intervals: 1m, 5m, 15m, 30m, 1h, 4h, 1d
 * Supported ranges: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
 * 
 * Defaults: interval=1h, range=5d
 */
export async function getChart(req: Request, res: Response): Promise<void> {
  const { symbol, interval, range } = req.query;

  // Validate required symbol
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const baseSymbol = getBaseSymbol(rawSymbol);

  // Validate symbol format
  validateSymbol(baseSymbol);

  // Resolve interval with default
  let resolvedInterval: SupportedInterval = BIST_DEFAULT_INTERVAL;
  if (interval && typeof interval === 'string' && interval.trim() !== '') {
    const inputInterval = interval.trim().toLowerCase();
    if (!isSupportedInterval(inputInterval)) {
      throw new AppError(
        400,
        `Invalid interval: "${interval}". Supported intervals: ${SUPPORTED_INTERVALS.join(', ')}`,
        'INVALID_INTERVAL'
      );
    }
    resolvedInterval = inputInterval;
  }

  // Resolve range with default
  let resolvedRange = BIST_DEFAULT_RANGE;
  if (range && typeof range === 'string' && range.trim() !== '') {
    const inputRange = range.trim().toLowerCase();
    if (!isValidYahooRange(inputRange)) {
      throw new AppError(
        400,
        `Invalid range: "${range}". Valid ranges: ${YAHOO_RANGES.join(', ')}`,
        'INVALID_RANGE'
      );
    }
    resolvedRange = inputRange as typeof resolvedRange;
  }

  try {
    const result = await yahooService.getChart(baseSymbol, resolvedInterval, resolvedRange);
    sendSuccess(res, result);
  } catch (error) {
    handleYahooError(error);
  }
}

/**
 * GET /api/bist/detail?symbol=THYAO
 * 
 * Get detailed information for a BIST symbol.
 * Includes: company profile, dividend info, key statistics.
 */
export async function getBistDetail(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  // Validate required parameter
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const baseSymbol = getBaseSymbol(rawSymbol);

  // Validate symbol format
  validateSymbol(baseSymbol);

  try {
    const result = await yahooService.getDetail(baseSymbol);
    sendSuccess(res, result);
  } catch (error) {
    handleYahooError(error);
  }
}
