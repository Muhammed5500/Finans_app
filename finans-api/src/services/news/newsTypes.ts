// ─── News Service Types ──────────────────────────────────────────────────────

export type NewsCategory = 'crypto' | 'bist' | 'us' | 'economy';

export type NewsSourceId =
  | 'coindesk'
  | 'decrypt'
  | 'cointelegraph'
  | 'bloomberght'
  | 'dunya'
  | 'google_news_tr'
  | 'cnbc'
  | 'marketwatch'
  | 'bloomberg_markets'
  | 'yahoo_finance'
  | 'google_news_economy';

export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: NewsSourceId;
  sourceDisplayName: string;
  publishedAt: string;
  summary: string;
  imageUrl: string | null;
  category: NewsCategory;
  sentiment: Sentiment;
  language: 'en' | 'tr';
}

export interface RssSourceConfig {
  id: NewsSourceId;
  displayName: string;
  feedUrl: string;
  category: NewsCategory;
  language: 'en' | 'tr';
  imageExtractor: (item: any) => string | null;
}

export interface NewsCategoryResult {
  category: NewsCategory;
  count: number;
  items: NewsItem[];
  sources: string[];
  fetchedAt: string;
  cached: boolean;
}

export interface NewsAnalysisResult {
  quickLook: string[];
  affectedStocks: string[];
  sentiment: Sentiment;
  marketImpact: string;
  summary: string;
  keyPoints: string[];
}
