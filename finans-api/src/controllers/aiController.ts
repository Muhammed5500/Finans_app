import { Request, Response } from 'express';
import { chat, summarizeNews, analyzeNewsEnhanced, analyzePortfolio } from '../services/ai/aiService';
import { AppError } from '../utils/errors';

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const { message, context } = req.body;
  if (!message || typeof message !== 'string') {
    throw new AppError(400, 'Missing required field: message', 'MISSING_MESSAGE');
  }
  const reply = await chat(message.slice(0, 2000), context);
  res.json({ ok: true, result: { reply } });
}

export async function summarizeHandler(req: Request, res: Response): Promise<void> {
  const { title, source, summary } = req.body;
  if (!title || typeof title !== 'string') {
    throw new AppError(400, 'Missing required field: title', 'MISSING_TITLE');
  }
  const result = await summarizeNews(title, source, summary);
  res.json({ ok: true, result });
}

export async function analyzeNewsHandler(req: Request, res: Response): Promise<void> {
  const { title, source, summary, language } = req.body;
  if (!title || typeof title !== 'string') {
    throw new AppError(400, 'Missing required field: title', 'MISSING_TITLE');
  }
  const result = await analyzeNewsEnhanced(title, source, summary, language);
  res.json({ ok: true, result });
}

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
  const { holdings } = req.body;
  if (!Array.isArray(holdings)) {
    throw new AppError(400, 'Missing required field: holdings (array)', 'MISSING_HOLDINGS');
  }
  const analysis = await analyzePortfolio(holdings);
  res.json({ ok: true, result: { analysis } });
}
