import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getPrice,
  getPrices,
  get24hr,
  getKlines,
  getCryptoDetail,
} from '../controllers/cryptoController';

const router = Router();

// GET /api/crypto/price?symbol=BTCUSDT
router.get('/price', asyncHandler(getPrice));

// GET /api/crypto/prices?symbols=BTCUSDT,ETHUSDT,BNBUSDT
router.get('/prices', asyncHandler(getPrices));

// GET /api/crypto/24hr?symbol=BTCUSDT
router.get('/24hr', asyncHandler(get24hr));

// GET /api/crypto/klines?symbol=BTCUSDT&interval=1h&limit=100
router.get('/klines', asyncHandler(getKlines));

// GET /api/crypto/detail?symbol=BTC
router.get('/detail', asyncHandler(getCryptoDetail));

export default router;
