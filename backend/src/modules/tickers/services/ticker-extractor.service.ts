import { Injectable, Logger } from '@nestjs/common';
import { TickersRepository } from '../repositories/tickers.repository';

/**
 * Extraction result for a single text
 */
export interface ExtractionResult {
  /** Extracted ticker symbols */
  tickers: string[];
  /** Confidence scores (0-1) for each ticker */
  confidence: Map<string, number>;
}

/**
 * TickerExtractorService
 *
 * Extracts stock ticker symbols from news text.
 *
 * Strategies:
 * 1. Pattern matching: $AAPL, THYAO.IS, etc.
 * 2. Known ticker lookup in title/summary
 * 3. Company name to ticker mapping
 * 4. SEC CIK to ticker mapping (for SEC filings)
 */
@Injectable()
export class TickerExtractorService {
  private readonly logger = new Logger(TickerExtractorService.name);

  // TODO: Load from database/config
  private readonly TICKER_PATTERNS = [
    // US-style: $AAPL, $MSFT
    /\$([A-Z]{1,5})\b/g,
    // BIST-style: THYAO.IS, GARAN.IS
    /\b([A-Z]{2,5})\.IS\b/g,
    // Generic uppercase 2-5 letters surrounded by non-letters
    /(?<![A-Z])([A-Z]{2,5})(?![A-Z])/g,
  ];

  // Common words that look like tickers but aren't
  private readonly STOPWORDS = new Set([
    'A',
    'I',
    'AN',
    'AT',
    'BE',
    'BY',
    'DO',
    'GO',
    'HE',
    'IF',
    'IN',
    'IS',
    'IT',
    'MY',
    'NO',
    'OF',
    'OK',
    'ON',
    'OR',
    'SO',
    'TO',
    'UP',
    'US',
    'WE',
    'THE',
    'AND',
    'FOR',
    'ARE',
    'BUT',
    'NOT',
    'YOU',
    'ALL',
    'CAN',
    'HAS',
    'HER',
    'WAS',
    'ONE',
    'OUR',
    'OUT',
    'HIS',
    'HIM',
    'SEC',
    'CEO',
    'CFO',
    'IPO',
    'ETF',
    'GDP',
    'USA',
    'EUR',
    'USD',
    'TRY',
    'NEW',
    'NOW',
    'TOP',
    'INC',
    'LLC',
    'LTD',
    'PLC',
    'CEO',
    'CFO',
    'COO',
    'CTO',
  ]);

  constructor(private readonly tickersRepo: TickersRepository) {}

  /**
   * Extract tickers from news text
   */
  async extract(text: string): Promise<ExtractionResult> {
    // TODO: Implement ticker extraction
    //
    // Steps:
    // 1. Apply regex patterns to find candidates
    // 2. Filter out stopwords
    // 3. Validate against known tickers in database
    // 4. Calculate confidence based on:
    //    - Pattern strength ($AAPL > AAPL)
    //    - Position in text (title > body)
    //    - Frequency
    // 5. Return unique tickers with confidence scores

    this.logger.debug('TODO: Implement ticker extraction');

    const tickers: string[] = [];
    const confidence = new Map<string, number>();

    // Pattern matching
    for (const pattern of this.TICKER_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const symbol = match[1]?.toUpperCase();
        if (symbol && !this.STOPWORDS.has(symbol)) {
          if (!tickers.includes(symbol)) {
            tickers.push(symbol);
            confidence.set(symbol, 0.5); // TODO: Calculate actual confidence
          }
        }
      }
    }

    return { tickers, confidence };
  }

  /**
   * Extract tickers from news item (title + summary)
   */
  async extractFromNews(
    title: string,
    summary?: string,
  ): Promise<ExtractionResult> {
    // TODO: Implement combined extraction
    //
    // Steps:
    // 1. Extract from title (higher weight)
    // 2. Extract from summary (lower weight)
    // 3. Merge results
    // 4. Adjust confidence based on position

    const combined = `${title}\n${summary || ''}`;
    return this.extract(combined);
  }

  /**
   * Validate ticker against known symbols
   */
  async isValidTicker(_symbol: string): Promise<boolean> {
    // TODO: Check against database
    //
    // const ticker = await this.tickersRepo.findBySymbol(symbol);
    // return ticker !== null;

    return false;
  }
}
