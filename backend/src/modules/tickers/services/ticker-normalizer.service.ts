import { Injectable, Logger } from '@nestjs/common';

/**
 * Market identifiers
 */
export type Market = 'BIST' | 'NYSE' | 'NASDAQ' | 'LSE' | 'OTHER';

/**
 * Normalized ticker representation
 */
export interface NormalizedTicker {
  /** Normalized symbol */
  symbol: string;
  /** Market identifier */
  market: Market;
  /** Full symbol with market suffix (e.g., THYAO.IS) */
  fullSymbol: string;
}

/**
 * TickerNormalizerService
 *
 * Normalizes ticker symbols across different markets and formats.
 *
 * Handles:
 * - BIST tickers (THYAO.IS, GARAN.IS)
 * - US tickers ($AAPL, AAPL)
 * - UK tickers (BP.L, HSBA.L)
 * - Market suffix standardization
 */
@Injectable()
export class TickerNormalizerService {
  private readonly logger = new Logger(TickerNormalizerService.name);

  // Market suffix mappings
  private readonly MARKET_SUFFIXES: Record<string, Market> = {
    '.IS': 'BIST',
    '.E': 'BIST',
    '.L': 'LSE',
    '.N': 'NYSE',
    '.O': 'NASDAQ',
  };

  // Market suffix output
  private readonly MARKET_TO_SUFFIX: Record<Market, string> = {
    BIST: '.IS',
    NYSE: '',
    NASDAQ: '',
    LSE: '.L',
    OTHER: '',
  };

  /**
   * Normalize a ticker symbol
   */
  normalize(rawSymbol: string, defaultMarket?: Market): NormalizedTicker {
    // TODO: Implement normalization
    //
    // Steps:
    // 1. Remove common prefixes ($ for US stocks)
    // 2. Extract market suffix
    // 3. Uppercase the symbol
    // 4. Determine market from suffix or context
    // 5. Build full symbol with standard suffix

    let symbol = rawSymbol.trim().toUpperCase();
    let market: Market = defaultMarket || 'OTHER';

    // Remove $ prefix
    if (symbol.startsWith('$')) {
      symbol = symbol.slice(1);
      market = 'NYSE'; // Default US market
    }

    // Check for market suffix
    for (const [suffix, marketId] of Object.entries(this.MARKET_SUFFIXES)) {
      if (symbol.endsWith(suffix.toUpperCase())) {
        symbol = symbol.slice(0, -suffix.length);
        market = marketId;
        break;
      }
    }

    // Build full symbol
    const fullSymbol = symbol + this.MARKET_TO_SUFFIX[market];

    return {
      symbol,
      market,
      fullSymbol: fullSymbol || symbol,
    };
  }

  /**
   * Normalize multiple tickers
   */
  normalizeMany(symbols: string[], defaultMarket?: Market): NormalizedTicker[] {
    return symbols.map((s) => this.normalize(s, defaultMarket));
  }

  /**
   * Detect market from news source
   */
  detectMarketFromSource(sourceType: string): Market {
    // TODO: Implement market detection from source
    //
    // - KAP -> BIST
    // - SEC_RSS -> NYSE/NASDAQ
    // - GDELT -> depends on content

    switch (sourceType) {
      case 'KAP':
        return 'BIST';
      case 'SEC_RSS':
        return 'NYSE'; // Could be NASDAQ too
      default:
        return 'OTHER';
    }
  }

  /**
   * Check if two symbols refer to the same ticker
   */
  areSameTicker(symbol1: string, symbol2: string): boolean {
    const norm1 = this.normalize(symbol1);
    const norm2 = this.normalize(symbol2);
    return norm1.symbol === norm2.symbol && norm1.market === norm2.market;
  }
}
