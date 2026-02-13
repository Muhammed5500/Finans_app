import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNews, getArticle } from '../controllers/newsController';

const router = Router();

/**
 * GET /api/news?category=crypto|bist|us|economy&limit=20
 */
router.get('/', asyncHandler(getNews));

/**
 * GET /api/news/article/:id
 */
router.get('/article/:id', asyncHandler(getArticle));

export default router;
