import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { chatHandler, summarizeHandler, analyzeHandler } from '../controllers/aiController';

const router = Router();

router.post('/chat', asyncHandler(chatHandler));
router.post('/summarize', asyncHandler(summarizeHandler));
router.post('/analyze', asyncHandler(analyzeHandler));

export default router;
