import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { chatHandler, summarizeHandler, analyzeNewsHandler, analyzeHandler, matchPortfolioNewsHandler } from '../controllers/aiController';

const router = Router();

router.post('/chat', asyncHandler(chatHandler));
router.post('/summarize', asyncHandler(summarizeHandler));
router.post('/analyze-news', asyncHandler(analyzeNewsHandler));
router.post('/analyze', asyncHandler(analyzeHandler));
router.post('/match-portfolio-news', asyncHandler(matchPortfolioNewsHandler));

export default router;
