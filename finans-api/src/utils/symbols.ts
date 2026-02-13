/**
 * Symbol Normalization Utilities
 * 
 * Handles mapping between user-friendly symbols and exchange-specific formats.
 */

// -----------------------------------------------------------------------------
// BIST SYMBOLS
// -----------------------------------------------------------------------------

/**
 * Yahoo Finance suffix for BIST stocks
 */
export const BIST_SUFFIX = '.IS';

/**
 * Regex for validating BIST stock symbol format (without suffix)
 * BIST stock symbols are typically 3-6 uppercase letters
 */
export const BIST_STOCK_REGEX = /^[A-Z]{3,6}$/;

/**
 * Regex for validating BIST index symbol format (without suffix)
 * BIST indices start with X and can include numbers (e.g., XU100, XU030, XBANK)
 */
export const BIST_INDEX_REGEX = /^X[A-Z0-9]{2,5}$/;

/**
 * Combined regex for any BIST symbol
 */
export const BIST_SYMBOL_REGEX = /^([A-Z]{3,6}|X[A-Z0-9]{2,5})$/;

/**
 * Normalize a BIST symbol to Yahoo Finance format
 * 
 * Accepts:
 * - THYAO -> THYAO.IS
 * - thyao -> THYAO.IS
 * - THYAO.IS -> THYAO.IS
 * - thyao.is -> THYAO.IS
 * 
 * @param symbol - User input symbol
 * @returns Normalized symbol with .IS suffix
 */
export function normalizeBistSymbol(symbol: string): string {
  if (!symbol || typeof symbol !== 'string') {
    return '';
  }

  // Uppercase and trim
  let normalized = symbol.toUpperCase().trim();

  // Remove .IS suffix if present (we'll add it back)
  if (normalized.endsWith(BIST_SUFFIX)) {
    normalized = normalized.slice(0, -BIST_SUFFIX.length);
  }

  return `${normalized}${BIST_SUFFIX}`;
}

/**
 * Get the base symbol without suffix
 * 
 * @param symbol - Symbol with or without .IS suffix
 * @returns Base symbol (e.g., THYAO)
 */
export function getBaseSymbol(symbol: string): string {
  if (!symbol || typeof symbol !== 'string') {
    return '';
  }

  let base = symbol.toUpperCase().trim();

  if (base.endsWith(BIST_SUFFIX)) {
    base = base.slice(0, -BIST_SUFFIX.length);
  }

  return base;
}

/**
 * Validate BIST symbol format (base symbol without suffix)
 * 
 * @param symbol - Symbol to validate (with or without .IS suffix)
 * @returns true if valid BIST symbol format
 */
export function isValidBistSymbol(symbol: string): boolean {
  const base = getBaseSymbol(symbol);
  return BIST_SYMBOL_REGEX.test(base);
}

/**
 * Normalize multiple BIST symbols from comma-separated string
 * 
 * @param symbols - Comma-separated symbols (e.g., "THYAO,GARAN,AKBNK")
 * @returns Array of normalized symbols with .IS suffix
 */
export function normalizeBistSymbols(symbols: string): string[] {
  if (!symbols || typeof symbols !== 'string') {
    return [];
  }

  return symbols
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeBistSymbol);
}

/**
 * Get base symbols from comma-separated string
 * 
 * @param symbols - Comma-separated symbols
 * @returns Array of base symbols without .IS suffix
 */
export function getBaseSymbols(symbols: string): string[] {
  if (!symbols || typeof symbols !== 'string') {
    return [];
  }

  return symbols
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(getBaseSymbol);
}
