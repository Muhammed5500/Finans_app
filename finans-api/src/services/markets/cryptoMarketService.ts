/**
 * Crypto Market Service - Bulk Binance fetcher for crypto market data
 *
 * Fetches all 24hr tickers in a single API call, then filters to our symbol list.
 * Uses caching with shorter TTL than BIST/US (crypto moves faster).
 */

import { createBinanceClient, BinanceClient, Ticker24hr } from '../binance';
import { TTLCache, createCache } from '../../utils/cache';
import { mapSymbolAlias } from '../../config/crypto';

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const CRYPTO_CACHE_TTL_MS = 15_000;   // 15 seconds
const MAX_STALE_MS = 60_000;          // 60 seconds stale grace

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface CryptoQuote {
  symbol: string;       // Base symbol (e.g., "BTC")
  fullSymbol: string;   // Trading pair (e.g., "BTCUSDT")
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  volume?: number;
  quoteVolume?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
}

export interface CryptoMarketResponse {
  market: 'CRYPTO';
  count: number;
  success: number;
  failed: number;
  quotes: CryptoQuote[];
  errors: Array<{ symbol: string; error: string }>;
  fetchedAt: string;
  stale?: boolean;
}

// -----------------------------------------------------------------------------
// CRYPTO NAMES (for display in market listing)
// -----------------------------------------------------------------------------

const CRYPTO_DISPLAY_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana', XRP: 'XRP',
  DOGE: 'Dogecoin', ADA: 'Cardano', AVAX: 'Avalanche', DOT: 'Polkadot', LINK: 'Chainlink',
  MATIC: 'Polygon', SHIB: 'Shiba Inu', LTC: 'Litecoin', UNI: 'Uniswap', ATOM: 'Cosmos',
  NEAR: 'NEAR Protocol', FIL: 'Filecoin', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  IMX: 'Immutable X', INJ: 'Injective', FET: 'Fetch.ai', RNDR: 'Render', STX: 'Stacks',
  AAVE: 'Aave', GRT: 'The Graph', MKR: 'Maker', SNX: 'Synthetix', COMP: 'Compound',
  CRV: 'Curve DAO', LDO: 'Lido DAO', RPL: 'Rocket Pool', DYDX: 'dYdX',
  PEPE: 'Pepe', WLD: 'Worldcoin', SUI: 'Sui', SEI: 'Sei', TIA: 'Celestia',
  MANTA: 'Manta Network', JUP: 'Jupiter', PYTH: 'Pyth Network', WIF: 'dogwifhat',
  BONK: 'Bonk', FLOKI: 'Floki',
  TON: 'Toncoin', TRX: 'TRON', BCH: 'Bitcoin Cash', ETC: 'Ethereum Classic', XLM: 'Stellar',
  ALGO: 'Algorand', VET: 'VeChain', HBAR: 'Hedera', ICP: 'Internet Computer',
  EGLD: 'MultiversX', FTM: 'Fantom',
  SAND: 'The Sandbox', MANA: 'Decentraland', AXS: 'Axie Infinity', ENJ: 'Enjin Coin', GALA: 'Gala',
  THETA: 'Theta Network', RUNE: 'THORChain', KAS: 'Kaspa', QNT: 'Quant', FLOW: 'Flow',
  XTZ: 'Tezos', EOS: 'EOS', NEO: 'Neo',
  ZEC: 'Zcash', DASH: 'Dash', IOTA: 'IOTA', ONE: 'Harmony', ROSE: 'Oasis Network',
  CHZ: 'Chiliz', ENS: 'ENS', APE: 'ApeCoin', BLUR: 'Blur', MASK: 'Mask Network',
  OCEAN: 'Ocean Protocol', AGIX: 'SingularityNET', CFX: 'Conflux', CKB: 'Nervos Network', ASTR: 'Astar',
  CELO: 'Celo', ZIL: 'Zilliqa', ANKR: 'Ankr', '1INCH': '1inch',
  SUSHI: 'SushiSwap', BAL: 'Balancer', YFI: 'yearn.finance', BAND: 'Band Protocol', KAVA: 'Kava',
  OSMO: 'Osmosis', AKT: 'Akash Network', MINA: 'Mina Protocol', ZK: 'zkSync', STRK: 'Starknet',
  PENDLE: 'Pendle', JTO: 'Jito', W: 'Wormhole',
};

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

class CryptoMarketService {
  private readonly client: BinanceClient;
  private readonly cache: TTLCache<CryptoMarketResponse>;

  constructor() {
    this.client = createBinanceClient();
    this.cache = createCache<CryptoMarketResponse>();
  }

  /**
   * Fetch quotes for all tracked crypto symbols via single Binance API call
   */
  async fetchMarket(symbols: string[]): Promise<CryptoMarketResponse> {
    const cacheKey = 'market:CRYPTO';

    // Check fresh cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.fetchAll(symbols);
      this.cache.set(cacheKey, result, CRYPTO_CACHE_TTL_MS);
      return result;
    } catch (error) {
      // Try stale cache
      const stale = this.cache.getWithStale(cacheKey, MAX_STALE_MS);
      if (stale) {
        return { ...stale.value, stale: true };
      }
      throw error;
    }
  }

  /**
   * Fetch all 24hr tickers and filter to our symbols
   */
  private async fetchAll(symbols: string[]): Promise<CryptoMarketResponse> {
    const quotes: CryptoQuote[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    // Build a set of USDT trading pairs we care about
    const pairToBase = new Map<string, string>();
    for (const sym of symbols) {
      const pair = mapSymbolAlias(sym);
      pairToBase.set(pair, sym.toUpperCase());
    }

    console.log(`[CryptoMarketService] Fetching all 24hr tickers for ${symbols.length} symbols`);

    const allTickers = await this.client.getAll24hr();

    // Filter to our symbols
    for (const ticker of allTickers) {
      const base = pairToBase.get(ticker.symbol);
      if (!base) continue;

      try {
        quotes.push({
          symbol: base,
          fullSymbol: ticker.symbol,
          name: CRYPTO_DISPLAY_NAMES[base] || base,
          price: parseFloat(ticker.lastPrice),
          change: parseFloat(ticker.priceChange),
          changePercent: parseFloat(ticker.priceChangePercent),
          currency: 'USDT',
          volume: parseFloat(ticker.volume),
          quoteVolume: parseFloat(ticker.quoteVolume),
          dayHigh: parseFloat(ticker.highPrice),
          dayLow: parseFloat(ticker.lowPrice),
          previousClose: parseFloat(ticker.prevClosePrice),
        });
        // Remove from map so we can track missing ones
        pairToBase.delete(ticker.symbol);
      } catch (err: any) {
        errors.push({ symbol: base, error: err.message || 'Parse error' });
        pairToBase.delete(ticker.symbol);
      }
    }

    // Any remaining in pairToBase were not found
    for (const [pair, base] of pairToBase.entries()) {
      errors.push({ symbol: base, error: `${pair} not found in Binance 24hr data` });
    }

    // Sort by symbol
    quotes.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return {
      market: 'CRYPTO',
      count: symbols.length,
      success: quotes.length,
      failed: errors.length,
      quotes,
      errors,
      fetchedAt: new Date().toISOString(),
    };
  }

  destroy(): void {
    this.cache.destroy();
  }
}

// Singleton
let instance: CryptoMarketService | null = null;

export function getCryptoMarketService(): CryptoMarketService {
  if (!instance) {
    instance = new CryptoMarketService();
  }
  return instance;
}
