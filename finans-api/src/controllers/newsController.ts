import { Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { getNewsService, NEWS_CATEGORIES } from '../services/news';

/**
 * GET /api/news?category=crypto|bist|us|economy&limit=20
 */
export async function getNews(req: Request, res: Response): Promise<void> {
  const { category = 'crypto', limit: limitStr = '20' } = req.query;

  if (typeof category !== 'string') {
    throw new AppError(400, 'Invalid category parameter', 'INVALID_PARAM');
  }

  if (!NEWS_CATEGORIES.includes(category as any)) {
    throw new AppError(
      400,
      `Unknown category: ${category}. Valid: ${NEWS_CATEGORIES.join(', ')}`,
      'INVALID_CATEGORY',
    );
  }

  const limit = Math.min(Math.max(parseInt(limitStr as string, 10) || 20, 1), 50);
  const result = await getNewsService().getNewsByCategory(category as any, limit);

  res.json({ ok: true, result });
}

/**
 * GET /api/news/article/:id
 */
export async function getArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new AppError(400, 'Article ID is required', 'MISSING_ID');
  }

  const article = getNewsService().getArticleById(id);

  if (!article) {
    throw new AppError(404, 'Article not found', 'NOT_FOUND');
  }

  res.json({ ok: true, result: article });
}
