/**
 * US market REST controller.
 * GET /api/us/quote, /api/us/quotes, /api/us/chart, /api/us/detail
 */

import { Request, Response } from 'express';
import { createUsService, US_INTERVALS, type UsInterval } from '../services/us';
import { getYahooService } from '../services/yahoo/yahooService';
import { isSupportedInterval, type SupportedInterval } from '../services/yahoo/yahooService';
import type { YahooRange } from '../services/yahoo/types';
import { AppError } from '../utils/errors';

const usService = createUsService();

/** Map rangeDays to Yahoo Finance range + interval */
const RANGE_DAYS_MAP: Record<string, { interval: SupportedInterval; range: YahooRange }> = {
  '1':   { interval: '5m',  range: '1d' },
  '5':   { interval: '1h',  range: '5d' },
  '7':   { interval: '1h',  range: '5d' },
  '30':  { interval: '1h',  range: '1mo' },
  '90':  { interval: '1d',  range: '3mo' },
  '180': { interval: '1d',  range: '6mo' },
  '365': { interval: '1d',  range: '1y' },
};

/** Default symbols when /quotes is called without symbols param */
export const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];

function sendSuccess(res: Response, result: unknown): void {
  res.json({ ok: true, result });
}

/**
 * GET /api/us/quote?symbol=AAPL
 */
export async function getUsQuote(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const result = await usService.getUsQuote(symbol.trim());
  sendSuccess(res, result);
}

/**
 * GET /api/us/quotes?symbols=AAPL,MSFT,NVDA
 * If symbols is missing or empty, uses DEFAULT_SYMBOLS.
 */
export async function getUsQuotes(req: Request, res: Response): Promise<void> {
  const { symbols } = req.query;

  let symbolList: string[];

  if (!symbols || typeof symbols !== 'string' || !symbols.trim()) {
    symbolList = [...DEFAULT_SYMBOLS];
  } else {
    symbolList = symbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (symbolList.length === 0) {
      symbolList = [...DEFAULT_SYMBOLS];
    }
  }

  const result = await usService.getUsQuotes(symbolList);
  sendSuccess(res, result);
}

/**
 * GET /api/us/chart?symbol=AAPL&interval=1h&rangeDays=5
 * symbol required; interval and rangeDays optional (defaults: 1h, 5).
 *
 * Uses Yahoo Finance for chart data (no API key required).
 * Falls back to Finnhub if Yahoo fails and FINNHUB_API_KEY is configured.
 */
export async function getUsChart(req: Request, res: Response): Promise<void> {
  const { symbol, interval, rangeDays } = req.query;

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const sym = symbol.trim();
  const rangeDaysStr = typeof rangeDays === 'string' ? rangeDays : '5';
  const intervalStr = typeof interval === 'string' ? interval : '1h';

  // Try Yahoo Finance first (no API key needed)
  try {
    const yahooService = getYahooService();
    const mapping = RANGE_DAYS_MAP[rangeDaysStr] || RANGE_DAYS_MAP['5'];
    const yahooInterval = isSupportedInterval(intervalStr) ? intervalStr : mapping.interval;
    const result = await yahooService.getUsChart(sym, yahooInterval, mapping.range);
    sendSuccess(res, result);
    return;
  } catch (yahooErr) {
    // If Finnhub API key is available, try as fallback
    const finnhubKey = process.env.FINNHUB_API_KEY || process.env.FINNHUB_TOKEN || '';
    if (!finnhubKey) {
      throw yahooErr; // No Finnhub key either, throw Yahoo error
    }
  }

  // Finnhub fallback
  if (interval !== undefined && interval !== '' && typeof interval === 'string') {
    const inv = interval.trim().toLowerCase() as UsInterval;
    if (!US_INTERVALS.includes(inv)) {
      throw new AppError(
        400,
        `Invalid interval: "${interval}". Valid: ${US_INTERVALS.join(', ')}`,
        'INVALID_INTERVAL'
      );
    }
  }

  const result = await usService.getUsChart(
    sym,
    typeof interval === 'string' ? interval : undefined,
    typeof rangeDays === 'string' ? rangeDays : undefined
  );
  sendSuccess(res, result);
}

/**
 * GET /api/us/detail?symbol=AAPL
 * Get detailed fundamental data for a US stock (sector, industry, description, etc.)
 */
export async function getUsDetail(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const yahooService = getYahooService();
  const result = await yahooService.getUsDetail(symbol.trim());
  sendSuccess(res, result);
}
