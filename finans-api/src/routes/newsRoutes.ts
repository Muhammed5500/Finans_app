/**
 * News Routes - Fetches news from external APIs
 * 
 * Uses CryptoPanic for crypto news and RSS feeds for other categories
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNews } from '../controllers/newsController';

const router = Router();

/**
 * GET /api/news?category=crypto|bist|us|economy&limit=20
 * 
 * Get news for a specific category
 */
router.get('/', asyncHandler(getNews));

export default router;
