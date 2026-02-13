import { NewsCategory, RssSourceConfig } from './newsTypes';

// ─── Image Extractors ────────────────────────────────────────────────────────

function extractMediaContent(item: any): string | null {
  // media:content or media:thumbnail
  const mc = item['media:content'];
  if (mc?.$?.url) return mc.$.url;
  if (Array.isArray(mc) && mc[0]?.$?.url) return mc[0].$.url;
  const mt = item['media:thumbnail'];
  if (mt?.$?.url) return mt.$.url;
  if (Array.isArray(mt) && mt[0]?.$?.url) return mt[0].$.url;
  return null;
}

function extractEnclosure(item: any): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  return null;
}

function extractDecrypt(item: any): string | null {
  return extractEnclosure(item) || extractMediaContent(item);
}

function extractMediaOrEnclosure(item: any): string | null {
  return extractMediaContent(item) || extractEnclosure(item);
}

// ─── Source Registry ─────────────────────────────────────────────────────────

const RSS_SOURCES: RssSourceConfig[] = [
  // Crypto sources
  {
    id: 'coindesk',
    displayName: 'CoinDesk',
    feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'crypto',
    language: 'en',
    imageExtractor: extractMediaContent,
  },
  {
    id: 'decrypt',
    displayName: 'Decrypt',
    feedUrl: 'https://decrypt.co/feed',
    category: 'crypto',
    language: 'en',
    imageExtractor: extractDecrypt,
  },
  {
    id: 'cointelegraph',
    displayName: 'Cointelegraph',
    feedUrl: 'https://cointelegraph.com/rss',
    category: 'crypto',
    language: 'en',
    imageExtractor: extractMediaContent,
  },

  // BIST sources
  {
    id: 'bloomberght',
    displayName: 'Bloomberg HT',
    feedUrl: 'https://www.bloomberght.com/rss',
    category: 'bist',
    language: 'tr',
    imageExtractor: extractEnclosure,
  },
  {
    id: 'dunya',
    displayName: 'Dünya',
    feedUrl: 'https://www.dunya.com/rss',
    category: 'bist',
    language: 'tr',
    imageExtractor: extractEnclosure,
  },
  {
    id: 'google_news_tr',
    displayName: 'Google News',
    feedUrl: 'https://news.google.com/rss/search?q=borsa+istanbul+OR+BIST&hl=tr&gl=TR&ceid=TR:tr',
    category: 'bist',
    language: 'tr',
    imageExtractor: () => null,
  },

  // US sources
  {
    id: 'cnbc',
    displayName: 'CNBC',
    feedUrl: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'us',
    language: 'en',
    imageExtractor: () => null,
  },
  {
    id: 'marketwatch',
    displayName: 'MarketWatch',
    feedUrl: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    category: 'us',
    language: 'en',
    imageExtractor: extractMediaContent,
  },
  {
    id: 'bloomberg_markets',
    displayName: 'Bloomberg',
    feedUrl: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'us',
    language: 'en',
    imageExtractor: extractMediaContent,
  },

  // Economy sources
  {
    id: 'yahoo_finance',
    displayName: 'Yahoo Finance',
    feedUrl: 'https://finance.yahoo.com/news/rssindex',
    category: 'economy',
    language: 'en',
    imageExtractor: extractMediaContent,
  },
  {
    id: 'google_news_economy',
    displayName: 'Google News',
    feedUrl: 'https://news.google.com/rss/search?q=economy+OR+inflation+OR+interest+rates&hl=en&gl=US&ceid=US:en',
    category: 'economy',
    language: 'en',
    imageExtractor: () => null,
  },
];

export const NEWS_CATEGORIES: NewsCategory[] = ['crypto', 'bist', 'us', 'economy'];

export function getSourcesForCategory(category: NewsCategory): RssSourceConfig[] {
  return RSS_SOURCES.filter(s => s.category === category);
}

export function getAllSources(): RssSourceConfig[] {
  return RSS_SOURCES;
}
