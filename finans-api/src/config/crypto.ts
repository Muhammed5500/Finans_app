/**
 * Crypto module configuration
 */

// Default symbols for price listing
export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
] as const;

// Default interval for klines
export const DEFAULT_INTERVAL = '1h';

// Default limit for klines
export const DEFAULT_KLINES_LIMIT = 100;

// Supported quote currency
export const SUPPORTED_QUOTE = 'USDT';

// Common symbol aliases (short -> full)
const SYMBOL_ALIASES: Record<string, string> = {
  // Top coins
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT', XRP: 'XRPUSDT',
  DOGE: 'DOGEUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', DOT: 'DOTUSDT', LINK: 'LINKUSDT',
  MATIC: 'MATICUSDT', SHIB: 'SHIBUSDT', LTC: 'LTCUSDT', UNI: 'UNIUSDT', ATOM: 'ATOMUSDT',
  NEAR: 'NEARUSDT', FIL: 'FILUSDT', APT: 'APTUSDT', ARB: 'ARBUSDT', OP: 'OPUSDT',
  IMX: 'IMXUSDT', INJ: 'INJUSDT', FET: 'FETUSDT', RNDR: 'RNDRUSDT', STX: 'STXUSDT',
  // DeFi
  AAVE: 'AAVEUSDT', GRT: 'GRTUSDT', MKR: 'MKRUSDT', SNX: 'SNXUSDT', COMP: 'COMPUSDT',
  CRV: 'CRVUSDT', LDO: 'LDOUSDT', RPL: 'RPLUSDT', DYDX: 'DYDXUSDT',
  // Meme & New
  PEPE: 'PEPEUSDT', WLD: 'WLDUSDT', SUI: 'SUIUSDT', SEI: 'SEIUSDT', TIA: 'TIAUSDT',
  MANTA: 'MANTAUSDT', JUP: 'JUPUSDT', PYTH: 'PYTHUSDT', WIF: 'WIFUSDT', BONK: 'BONKUSDT',
  FLOKI: 'FLOKIUSDT',
  // Major alts
  TON: 'TONUSDT', TRX: 'TRXUSDT', BCH: 'BCHUSDT', ETC: 'ETCUSDT', XLM: 'XLMUSDT',
  ALGO: 'ALGOUSDT', VET: 'VETUSDT', HBAR: 'HBARUSDT', ICP: 'ICPUSDT', EGLD: 'EGLDUSDT',
  FTM: 'FTMUSDT',
  // Gaming & Metaverse
  SAND: 'SANDUSDT', MANA: 'MANAUSDT', AXS: 'AXSUSDT', ENJ: 'ENJUSDT', GALA: 'GALAUSDT',
  // Infrastructure
  THETA: 'THETAUSDT', RUNE: 'RUNEUSDT', KAS: 'KASUSDT', QNT: 'QNTUSDT', FLOW: 'FLOWUSDT',
  XTZ: 'XTZUSDT', EOS: 'EOSUSDT', NEO: 'NEOUSDT',
  // Privacy & Legacy
  ZEC: 'ZECUSDT', DASH: 'DASHUSDT', IOTA: 'IOTAUSDT', ONE: 'ONEUSDT', ROSE: 'ROSEUSDT',
  // Social & Identity
  CHZ: 'CHZUSDT', ENS: 'ENSUSDT', APE: 'APEUSDT', BLUR: 'BLURUSDT', MASK: 'MASKUSDT',
  // AI & Data
  OCEAN: 'OCEANUSDT', AGIX: 'AGIXUSDT', CFX: 'CFXUSDT', CKB: 'CKBUSDT', ASTR: 'ASTRUSDT',
  // Additional
  CELO: 'CELOUSDT', ZIL: 'ZILUSDT', ANKR: 'ANKRUSDT', '1INCH': '1INCHUSDT',
  SUSHI: 'SUSHIUSDT', BAL: 'BALUSDT', YFI: 'YFIUSDT', BAND: 'BANDUSDT', KAVA: 'KAVAUSDT',
  OSMO: 'OSMOUSDT', AKT: 'AKTUSDT', MINA: 'MINAUSDT', ZK: 'ZKUSDT', STRK: 'STRKUSDT',
  PENDLE: 'PENDLEUSDT', JTO: 'JTOUSDT', W: 'WUSDT',
};

/**
 * Map a symbol alias to full trading pair
 * - If symbol already ends with USDT, keep it
 * - If symbol is a known alias (BTC, ETH, etc.), map to full pair
 * - Otherwise, append USDT as quote currency
 * 
 * @param symbol - Raw symbol input (e.g., "BTC", "BTCUSDT", "eth")
 * @returns Full trading pair (e.g., "BTCUSDT", "ETHUSDT")
 */
export function mapSymbolAlias(symbol: string): string {
  const upper = symbol.toUpperCase().trim();

  // Already includes USDT suffix
  if (upper.endsWith(SUPPORTED_QUOTE)) {
    return upper;
  }

  // Check known aliases
  if (SYMBOL_ALIASES[upper]) {
    return SYMBOL_ALIASES[upper];
  }

  // Default: append USDT
  return `${upper}${SUPPORTED_QUOTE}`;
}

/**
 * Map multiple symbols, handling comma-separated input
 * @param symbols - Comma-separated symbols or array
 * @returns Array of full trading pairs
 */
export function mapSymbols(symbols: string | string[]): string[] {
  const symbolArray = Array.isArray(symbols)
    ? symbols
    : symbols.split(',').map((s) => s.trim()).filter(Boolean);

  return symbolArray.map(mapSymbolAlias);
}

/**
 * Check if a symbol (after mapping) is valid format
 * This is a basic check; actual validity is confirmed by Binance API
 */
export function isValidMappedSymbol(symbol: string): boolean {
  // Must be uppercase, alphanumeric, 5-20 chars, end with USDT
  const mapped = mapSymbolAlias(symbol);
  return /^[A-Z0-9]{5,20}$/.test(mapped) && mapped.endsWith(SUPPORTED_QUOTE);
}
