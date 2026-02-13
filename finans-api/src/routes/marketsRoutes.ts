import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getBistMarket, getUsMarket, getCryptoMarket, getForexMarket, getCommodityMarket, getFundMarket } from '../controllers/marketsController';

const router = Router();

/**
 * GET /api/markets/bist      - All BIST 100 quotes via Yahoo Finance
 * GET /api/markets/us        - All S&P 500 quotes via Yahoo Finance
 * GET /api/markets/crypto    - All tracked crypto quotes via Binance
 * GET /api/markets/forex     - Forex currency pairs via Yahoo Finance
 * GET /api/markets/commodity - Commodity futures via Yahoo Finance
 * GET /api/markets/fund      - Funds/ETFs via Yahoo Finance
 */
router.get('/bist', asyncHandler(getBistMarket));
router.get('/us', asyncHandler(getUsMarket));
router.get('/crypto', asyncHandler(getCryptoMarket));
router.get('/forex', asyncHandler(getForexMarket));
router.get('/commodity', asyncHandler(getCommodityMarket));
router.get('/fund', asyncHandler(getFundMarket));

export default router;
