/**
 * News Controller
 * 
 * Fetches news from external sources:
 * - Crypto: CryptoPanic API (free, no auth needed for public posts)
 * - BIST/Economy: Google News RSS via proxy
 * - US: Google News RSS via proxy
 */

import { Request, Response } from 'express';
import { AppError } from '../utils/errors';

// RSS to JSON proxy (public service)
const RSS_PROXY = 'https://api.rss2json.com/v1/api.json';

// RSS feeds by category
const RSS_FEEDS: Record<string, string> = {
  crypto: 'https://cointelegraph.com/rss',
  bist: 'https://news.google.com/rss/search?q=borsa+istanbul+OR+BIST&hl=tr&gl=TR&ceid=TR:tr',
  us: 'https://news.google.com/rss/search?q=stock+market+OR+wall+street&hl=en&gl=US&ceid=US:en',
  economy: 'https://news.google.com/rss/search?q=economy+OR+inflation+OR+interest+rates&hl=en&gl=US&ceid=US:en',
};

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  imageUrl?: string;
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

// Keyword-based sentiment scoring
const POSITIVE_KEYWORDS = [
  'rally', 'surge', 'gain', 'rise', 'bull', 'record high', 'breakout',
  'growth', 'profit', 'upgrade', 'beat', 'soar', 'outperform', 'milestone',
  'boom', 'recovery', 'optimism', 'bullish', 'up', 'higher', 'strong',
];

const NEGATIVE_KEYWORDS = [
  'crash', 'plunge', 'drop', 'fall', 'bear', 'loss', 'decline', 'sell-off',
  'crisis', 'downturn', 'recession', 'default', 'bankruptcy', 'downgrade',
  'miss', 'slump', 'fear', 'bearish', 'down', 'lower', 'weak', 'warning',
];

function scoreSentiment(title: string, summary?: string): 'positive' | 'negative' | 'neutral' {
  const text = `${title} ${summary || ''}`.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const kw of POSITIVE_KEYWORDS) {
    if (text.includes(kw)) pos++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (text.includes(kw)) neg++;
  }
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

/**
 * Fetch news from RSS feed via proxy
 */
async function fetchRssNews(category: string, limit: number): Promise<NewsItem[]> {
  const feedUrl = RSS_FEEDS[category];
  if (!feedUrl) return [];
  
  try {
    const proxyUrl = `${RSS_PROXY}?rss_url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`RSS proxy error: ${res.status}`);
    
    const data = await res.json() as { status: string; items?: any[]; feed?: { title?: string } };
    if (data.status !== 'ok') throw new Error('RSS parse failed');

    const items = data.items || [];

    return items.slice(0, limit).map((item: any, i: number) => {
      const title = item.title || '';
      const summary = item.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '';
      return {
        id: `${category}-${i}-${Date.now()}`,
        title,
        url: item.link || '#',
        source: item.author || data.feed?.title || 'Google News',
        publishedAt: item.pubDate || new Date().toISOString(),
        summary,
        imageUrl: item.enclosure?.link || item.thumbnail || null,
        category,
        sentiment: scoreSentiment(title, summary),
      };
    });
  } catch (err) {
    console.error(`[News] RSS fetch failed for ${category}:`, err);
    return [];
  }
}

/**
 * GET /api/news?category=crypto|bist|us|economy&limit=20
 */
export async function getNews(req: Request, res: Response): Promise<void> {
  const { category = 'crypto', limit: limitStr = '20' } = req.query;
  
  if (typeof category !== 'string') {
    throw new AppError(400, 'Invalid category parameter', 'INVALID_PARAM');
  }
  
  const limit = Math.min(Math.max(parseInt(limitStr as string, 10) || 20, 1), 50);
  
  let items: NewsItem[] = [];
  
  if (['crypto', 'bist', 'us', 'economy'].includes(category)) {
    items = await fetchRssNews(category, limit);
  } else {
    throw new AppError(400, `Unknown category: ${category}. Valid: crypto, bist, us, economy`, 'INVALID_CATEGORY');
  }
  
  res.json({
    ok: true,
    result: {
      category,
      count: items.length,
      items,
      fetchedAt: new Date().toISOString(),
    },
  });
}
