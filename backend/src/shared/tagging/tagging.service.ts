import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Ticker extraction result
 */
export interface TickerMatch {
  symbol: string;
  matchedText: string;
  matchType: 'symbol' | 'alias';
}

/**
 * Tag extraction result
 */
export interface TagMatch {
  tag: string;
  matchedKeywords: string[];
}

/**
 * Common ticker aliases (company names, common terms)
 */
const TICKER_ALIASES: Record<string, string> = {
  // Crypto
  bitcoin: 'BTC',
  btc: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  ether: 'ETH',
  solana: 'SOL',
  sol: 'SOL',
  ripple: 'XRP',
  xrp: 'XRP',
  dogecoin: 'DOGE',
  doge: 'DOGE',
  'binance coin': 'BNB',
  cardano: 'ADA',
  avalanche: 'AVAX',

  // US Companies
  apple: 'AAPL',
  tesla: 'TSLA',
  microsoft: 'MSFT',
  google: 'GOOGL',
  alphabet: 'GOOGL',
  amazon: 'AMZN',
  meta: 'META',
  facebook: 'META',
  nvidia: 'NVDA',
  jpmorgan: 'JPM',
  'jp morgan': 'JPM',

  // Turkish Companies
  'türk hava yolları': 'THYAO',
  'turk hava yollari': 'THYAO',
  thy: 'THYAO',
  'turkish airlines': 'THYAO',
  tüpraş: 'TUPRS',
  tupras: 'TUPRS',
  tüpras: 'TUPRS',
  garanti: 'GARAN',
  'garanti bankası': 'GARAN',
  'garanti bankasi': 'GARAN',
  akbank: 'AKBNK',
  'koç holding': 'KCHOL',
  'koc holding': 'KCHOL',
  sabancı: 'SAHOL',
  sabanci: 'SAHOL',

  // Macro/Economic
  'federal reserve': 'FED',
  'the fed': 'FED',
  fed: 'FED',
  fomc: 'FOMC',
  ecb: 'ECB',
  'european central bank': 'ECB',
  tcmb: 'TCMB',
  'merkez bankası': 'TCMB',
  'consumer price index': 'CPI',
  cpi: 'CPI',
  inflation: 'CPI',
  'producer price index': 'PPI',
  ppi: 'PPI',
  gdp: 'GDP',
  'gross domestic product': 'GDP',
  'non-farm payrolls': 'NFP',
  'nonfarm payrolls': 'NFP',
  nfp: 'NFP',
  'jobs report': 'NFP',
  'dollar index': 'DXY',
  dxy: 'DXY',
  vix: 'VIX',
  'volatility index': 'VIX',
  'fear index': 'VIX',
};

/**
 * Tag categories with associated keywords
 */
const TAG_KEYWORDS: Record<string, string[]> = {
  // Market Events
  earnings: [
    'earnings',
    'quarterly results',
    'q1',
    'q2',
    'q3',
    'q4',
    'revenue',
    'profit',
    'eps',
    'beat',
    'miss',
    'guidance',
    'forecast',
    'outlook',
    'financial results',
  ],
  merger: [
    'merger',
    'acquisition',
    'acquire',
    'acquires',
    'acquired',
    'takeover',
    'buyout',
    'deal',
    'merge',
    'consolidation',
  ],
  ipo: [
    'ipo',
    'initial public offering',
    'going public',
    'debut',
    'listing',
    'public offering',
  ],
  dividend: ['dividend', 'payout', 'yield', 'distribution', 'ex-dividend'],
  buyback: [
    'buyback',
    'share repurchase',
    'stock repurchase',
    'repurchase program',
  ],

  // Corporate Events
  layoffs: [
    'layoff',
    'layoffs',
    'job cuts',
    'workforce reduction',
    'downsizing',
    'restructuring',
    'firing',
    'let go',
  ],
  lawsuit: [
    'lawsuit',
    'sue',
    'sues',
    'sued',
    'legal action',
    'litigation',
    'court',
    'settlement',
    'fine',
    'penalty',
    'antitrust',
  ],
  regulation: [
    'regulation',
    'regulatory',
    'regulator',
    'sec',
    'ftc',
    'doj',
    'compliance',
    'investigation',
    'probe',
    'scrutiny',
    'spk',
    'bddk',
    'sermaye piyasası',
  ],

  // Macro/Economic
  macro: [
    'macro',
    'economy',
    'economic',
    'gdp',
    'growth',
    'recession',
    'expansion',
    'contraction',
    'unemployment',
    'jobs',
  ],
  rates: [
    'interest rate',
    'rate hike',
    'rate cut',
    'basis points',
    'bps',
    'fed funds',
    'monetary policy',
    'hawkish',
    'dovish',
    'tightening',
    'easing',
    'raises rates',
    'rate pause',
    'rate decision',
    'faiz',
    'politika faizi',
    'faizini',
    'faiz oranı',
  ],
  inflation: [
    'inflation',
    'cpi',
    'ppi',
    'price',
    'prices',
    'deflationary',
    'stagflation',
    'enflasyon',
    'tüfe',
    'üfe',
  ],

  // Asset Classes
  crypto: [
    'crypto',
    'cryptocurrency',
    'bitcoin',
    'btc',
    'ethereum',
    'eth',
    'blockchain',
    'defi',
    'nft',
    'altcoin',
    'token',
    'mining',
    'wallet',
    'exchange',
    'binance',
    'coinbase',
    'kripto',
  ],
  commodities: [
    'oil',
    'gold',
    'silver',
    'copper',
    'crude',
    'wti',
    'brent',
    'natural gas',
    'commodity',
    'commodities',
    'petrol',
    'altın',
  ],
  forex: [
    'forex',
    'currency',
    'dollar',
    'euro',
    'yen',
    'pound',
    'usd',
    'eur',
    'gbp',
    'jpy',
    'exchange rate',
    'döviz',
    'kur',
    'türk lirası',
    'tl',
  ],

  // Sentiment
  breaking: [
    'breaking',
    'just in',
    'alert',
    'urgent',
    'developing',
    'flash',
    'son dakika',
    'flaş',
  ],
  analysis: [
    'analysis',
    'analyst',
    'upgrade',
    'downgrade',
    'rating',
    'price target',
    'buy',
    'sell',
    'hold',
    'outperform',
    'underperform',
  ],

  // Sectors
  tech: [
    'tech',
    'technology',
    'software',
    'hardware',
    'ai',
    'artificial intelligence',
    'cloud',
    'saas',
    'semiconductor',
    'chip',
    'chips',
  ],
  energy: [
    'energy',
    'oil',
    'gas',
    'renewable',
    'solar',
    'wind',
    'nuclear',
    'utilities',
    'power',
    'enerji',
  ],
  finance: [
    'bank',
    'banks',
    'banking',
    'financial',
    'insurance',
    'fintech',
    'payment',
    'credit',
    'loan',
    'lending',
    'banka',
    'finans',
  ],
  healthcare: [
    'healthcare',
    'health',
    'pharma',
    'pharmaceutical',
    'biotech',
    'drug',
    'fda',
    'clinical',
    'trial',
    'vaccine',
    'sağlık',
    'ilaç',
  ],

  // Geography
  turkey: [
    'turkey',
    'turkish',
    'türkiye',
    'türk',
    'istanbul',
    'ankara',
    'bist',
    'borsa istanbul',
  ],
  usa: [
    'usa',
    'us',
    'united states',
    'american',
    'wall street',
    'nasdaq',
    'nyse',
    'dow',
    's&p',
  ],
  europe: [
    'europe',
    'european',
    'eu',
    'eurozone',
    'germany',
    'france',
    'uk',
    'britain',
    'avrupa',
  ],
  asia: [
    'asia',
    'asian',
    'china',
    'chinese',
    'japan',
    'japanese',
    'korea',
    'korean',
    'india',
    'indian',
    'asya',
    'çin',
  ],
};

/**
 * TaggingService
 *
 * Lightweight, deterministic tagging engine for news items.
 * No AI - uses pattern matching and keyword lookup.
 *
 * Features:
 * - In-memory ticker cache (refreshes every 10 minutes)
 * - Exact symbol matching with word boundaries
 * - Alias mapping (company names -> symbols)
 * - Keyword-based tag extraction
 */
@Injectable()
export class TaggingService implements OnModuleInit {
  private readonly logger = new Logger(TaggingService.name);

  // In-memory ticker cache: symbol -> exists
  private tickerCache = new Set<string>();

  // Last cache refresh time
  private lastRefresh: Date | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshTickerCache();
  }

  /**
   * Refresh ticker cache from database
   * Called on init and every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshTickerCache(): Promise<void> {
    try {
      const tickers = await this.prisma.ticker.findMany({
        select: { symbol: true },
      });

      this.tickerCache = new Set(tickers.map((t) => t.symbol.toUpperCase()));
      this.lastRefresh = new Date();

      this.logger.log(
        `Ticker cache refreshed: ${this.tickerCache.size} symbols`,
      );
    } catch (error) {
      this.logger.error('Failed to refresh ticker cache', error);
      // Keep existing cache on error
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; lastRefresh: Date | null } {
    return {
      size: this.tickerCache.size,
      lastRefresh: this.lastRefresh,
    };
  }

  /**
   * Check if a symbol exists in cache
   */
  isKnownTicker(symbol: string): boolean {
    return this.tickerCache.has(symbol.toUpperCase());
  }

  /**
   * Extract ticker symbols from text.
   *
   * Strategy:
   * 1. Check for known aliases (company names, common terms)
   * 2. Find uppercase words that match known symbols
   * 3. Return unique symbols
   *
   * @param text - Title or text to extract from
   * @returns Array of ticker symbols
   */
  extractTickers(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const found = new Set<string>();
    const normalizedText = text.toLowerCase();

    // 1. Check aliases (longest match first)
    const sortedAliases = Object.entries(TICKER_ALIASES).sort(
      (a, b) => b[0].length - a[0].length,
    );

    for (const [alias, symbol] of sortedAliases) {
      // Use word boundary matching for aliases
      const pattern = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i');
      if (pattern.test(normalizedText)) {
        found.add(symbol);
      }
    }

    // 2. Find exact symbol matches (uppercase words, 1-5 chars)
    // Match: $AAPL, AAPL, THYAO.IS
    const symbolPattern = /\$?([A-Z]{1,5})(?:\.IS)?(?=\s|$|[.,!?;:])/g;
    const matches = text.matchAll(symbolPattern);

    for (const match of matches) {
      const symbol = match[1];
      // Only add if it's a known ticker
      if (this.tickerCache.has(symbol) || this.isWellKnownSymbol(symbol)) {
        found.add(symbol);
      }
    }

    return Array.from(found);
  }

  /**
   * Extract tags/categories from text.
   *
   * @param text - Title or text to extract from
   * @returns Array of tag names
   */
  extractTags(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const found = new Set<string>();
    const normalizedText = text.toLowerCase();

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
      for (const keyword of keywords) {
        // Use word boundary for multi-word keywords
        const pattern = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        if (pattern.test(normalizedText)) {
          found.add(tag);
          break; // One match is enough for this tag
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Extract both tickers and tags
   */
  extractAll(text: string): { tickers: string[]; tags: string[] } {
    return {
      tickers: this.extractTickers(text),
      tags: this.extractTags(text),
    };
  }

  /**
   * Check if symbol is well-known (even if not in DB)
   */
  private isWellKnownSymbol(symbol: string): boolean {
    const wellKnown = new Set([
      // Top US stocks
      'AAPL',
      'MSFT',
      'GOOGL',
      'GOOG',
      'AMZN',
      'META',
      'NVDA',
      'TSLA',
      'JPM',
      'V',
      'JNJ',
      'WMT',
      'PG',
      'MA',
      'UNH',
      'HD',
      'DIS',
      'PYPL',
      // Top ETFs
      'SPY',
      'QQQ',
      'IWM',
      'DIA',
      'VTI',
      'VOO',
      'EEM',
      'GLD',
      'SLV',
      // Top BIST
      'THYAO',
      'TUPRS',
      'GARAN',
      'AKBNK',
      'EREGL',
      'BIMAS',
      'KCHOL',
      'SAHOL',
      'SISE',
      'ASELS',
      'ISCTR',
      'YKBNK',
      'HALKB',
      'VAKBN',
      'PETKM',
      // Crypto
      'BTC',
      'ETH',
      'SOL',
      'BNB',
      'XRP',
      'DOGE',
      'ADA',
      'AVAX',
      'DOT',
      'MATIC',
      // Macro
      'FED',
      'CPI',
      'PPI',
      'GDP',
      'NFP',
      'FOMC',
      'ECB',
      'TCMB',
      'DXY',
      'VIX',
    ]);
    return wellKnown.has(symbol);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Standalone ticker extraction (no DB dependency)
 * Useful for testing or when DB is not available
 */
export function extractTickers(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const found = new Set<string>();
  const normalizedText = text.toLowerCase();

  // Check aliases
  const sortedAliases = Object.entries(TICKER_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [alias, symbol] of sortedAliases) {
    const pattern = new RegExp(
      `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    );
    if (pattern.test(normalizedText)) {
      found.add(symbol);
    }
  }

  // Find symbol matches
  const wellKnown = new Set([
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'META',
    'NVDA',
    'TSLA',
    'JPM',
    'SPY',
    'QQQ',
    'THYAO',
    'TUPRS',
    'GARAN',
    'AKBNK',
    'EREGL',
    'BIMAS',
    'KCHOL',
    'SAHOL',
    'BTC',
    'ETH',
    'SOL',
    'BNB',
    'XRP',
    'DOGE',
    'FED',
    'CPI',
    'PPI',
    'GDP',
    'NFP',
    'FOMC',
    'ECB',
    'TCMB',
    'DXY',
    'VIX',
  ]);

  const symbolPattern = /\$?([A-Z]{1,5})(?:\.IS)?(?=\s|$|[.,!?;:])/g;
  const matches = text.matchAll(symbolPattern);

  for (const match of matches) {
    const symbol = match[1];
    if (wellKnown.has(symbol)) {
      found.add(symbol);
    }
  }

  return Array.from(found);
}

/**
 * Standalone tag extraction (no DB dependency)
 */
export function extractTags(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const found = new Set<string>();
  const normalizedText = text.toLowerCase();

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      const pattern = new RegExp(
        `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      );
      if (pattern.test(normalizedText)) {
        found.add(tag);
        break;
      }
    }
  }

  return Array.from(found);
}
