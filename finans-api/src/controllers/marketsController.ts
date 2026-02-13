/**
 * Markets Controller
 *
 * Endpoints for fetching full market data (all tickers) for BIST and US.
 * Reads ticker lists from the backend database and fetches live prices via Yahoo Finance.
 */

import { Request, Response } from 'express';
import { getMarketService } from '../services/markets/marketService';
import { getCryptoMarketService } from '../services/markets/cryptoMarketService';

// ---------------------------------------------------------------------------
// Hardcoded symbol lists (mirrors backend database seed)
// These avoid a cross-service DB dependency at runtime.
// ---------------------------------------------------------------------------

const BIST_SYMBOLS = [
  'AEFES','AGHOL','AKBNK','AKCNS','AKFGY','AKSA','AKSEN','ALARK','ALFAS','ARCLK',
  'ARDYZ','ASELS','ASTOR','BERA','BIMAS','BIOEN','BRYAT','BUCIM','CANTE','CCOLA',
  'CEMTS','CIMSA','CWENE','DOAS','DOHOL','ECILC','EGEEN','EKGYO','ENJSA','ENKAI',
  'EREGL','EUPWR','EUREN','FROTO','GARAN','GESAN','GUBRF','HALKB','HEKTS','ISCTR',
  'ISGYO','ISMEN','KCHOL','KERVT','KLSER','KONTR','KONYA','KOZAA','KOZAL','KRDMD',
  'MAVI','MGROS','MPARK','ODAS','OTKAR','OYAKC','PGSUS','PETKM','SAHOL','SARKY',
  'SASA','SELEC','SISE','SKBNK','SMRTG','SOKM','TAVHL','TCELL','THYAO','TKFEN',
  'TKNSA','TMSN','TOASO','TTKOM','TTRAK','TUKAS','TUPRS','TURSG','ULKER','VAKBN',
  'VESBE','VESTL','YKBNK','YATAS','ZOREN',
];

const US_SYMBOLS = [
  'AAPL','MSFT','GOOGL','GOOG','AMZN','NVDA','META','TSLA','AVGO','ORCL',
  'CRM','AMD','ADBE','INTC','CSCO','QCOM','INTU','IBM','AMAT','NOW',
  'TXN','MU','LRCX','KLAC','SNPS','CDNS','PANW','PLTR',
  'NFLX','DIS','CMCSA','TMUS','VZ','T',
  'JPM','V','MA','BAC','WFC','GS','MS','BLK','SCHW','AXP','C','SPGI','CB','BX',
  'UNH','JNJ','LLY','ABBV','MRK','PFE','TMO','ABT','DHR','BMY','AMGN','GILD','ISRG','VRTX','MDT',
  'WMT','PG','KO','PEP','COST','HD','MCD','NKE','SBUX','TGT','LOW','CL',
  'CAT','GE','RTX','HON','UNP','BA','DE','LMT','UPS','MMM',
  'XOM','CVX','COP','SLB','EOG',
  'NEE','SO','DUK','AMT','PLD',
  'LIN','APD','FCX',
];

const FOREX_SYMBOLS = [
  'USDTRY=X','EURTRY=X','GBPTRY=X','EURUSD=X','GBPUSD=X','USDJPY=X',
  'USDCHF=X','AUDUSD=X','NZDUSD=X','USDCAD=X','EURGBP=X','EURJPY=X',
  'GBPJPY=X','USDCNY=X','USDINR=X',
];

const COMMODITY_SYMBOLS = [
  'GC=F','SI=F','CL=F','BZ=F','HG=F','NG=F','PL=F','PA=F',
  'ZC=F','ZW=F','ZS=F','KC=F',
];

const FUND_SYMBOLS = [
  'SPY','QQQ','IWM','DIA','VTI','VOO','VEA','VWO','GLD','SLV',
  'TLT','AGG','XLF','XLK','XLE','XLV','IBB','ARKK','EEM','HYG',
];

const CRYPTO_SYMBOLS = [
  'BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','DOT','LINK',
  'MATIC','SHIB','LTC','UNI','ATOM','NEAR','FIL','APT','ARB','OP',
  'IMX','INJ','FET','RNDR','STX','AAVE','GRT','MKR','SNX','COMP',
  'CRV','LDO','RPL','DYDX','PEPE','WLD','SUI','SEI','TIA','MANTA',
  'JUP','PYTH','WIF','BONK','FLOKI','TON','TRX','BCH','ETC','XLM',
  'ALGO','VET','HBAR','ICP','EGLD','FTM','SAND','MANA','AXS','ENJ',
  'GALA','THETA','RUNE','KAS','QNT','FLOW','XTZ','EOS','NEO','ZEC',
  'DASH','IOTA','ONE','ROSE','CHZ','ENS','APE','BLUR','MASK','OCEAN',
  'AGIX','CFX','CKB','ASTR','CELO','ZIL','ANKR','1INCH','SUSHI','BAL',
  'YFI','BAND','KAVA','OSMO','AKT','MINA','ZK','STRK','PENDLE','JTO','W',
];

/**
 * GET /api/markets/bist
 */
export async function getBistMarket(_req: Request, res: Response): Promise<void> {
  const service = getMarketService();
  const result = await service.fetchMarket(BIST_SYMBOLS, 'BIST');

  res.json({
    ok: true,
    result,
  });
}

/**
 * GET /api/markets/us
 */
export async function getUsMarket(_req: Request, res: Response): Promise<void> {
  const service = getMarketService();
  const result = await service.fetchMarket(US_SYMBOLS, 'US');

  res.json({
    ok: true,
    result,
  });
}

/**
 * GET /api/markets/crypto
 */
export async function getCryptoMarket(_req: Request, res: Response): Promise<void> {
  const service = getCryptoMarketService();
  const result = await service.fetchMarket(CRYPTO_SYMBOLS);

  res.json({
    ok: true,
    result,
  });
}

/**
 * GET /api/markets/forex
 */
export async function getForexMarket(_req: Request, res: Response): Promise<void> {
  const service = getMarketService();
  const result = await service.fetchMarket(FOREX_SYMBOLS, 'FOREX');

  res.json({
    ok: true,
    result,
  });
}

/**
 * GET /api/markets/commodity
 */
export async function getCommodityMarket(_req: Request, res: Response): Promise<void> {
  const service = getMarketService();
  const result = await service.fetchMarket(COMMODITY_SYMBOLS, 'COMMODITY');

  res.json({
    ok: true,
    result,
  });
}

/**
 * GET /api/markets/fund
 */
export async function getFundMarket(_req: Request, res: Response): Promise<void> {
  const service = getMarketService();
  const result = await service.fetchMarket(FUND_SYMBOLS, 'FUND');

  res.json({
    ok: true,
    result,
  });
}
