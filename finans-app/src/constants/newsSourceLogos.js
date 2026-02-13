export const NEWS_SOURCE_LOGOS = {
  coindesk: { label: 'CoinDesk', color: '#0052ff' },
  decrypt: { label: 'Decrypt', color: '#00d395' },
  cointelegraph: { label: 'Cointelegraph', color: '#ffd700' },
  bloomberght: { label: 'Bloomberg HT', color: '#2800d7' },
  dunya: { label: 'Dünya', color: '#d32f2f' },
  google_news_tr: { label: 'Google News', color: '#4285f4' },
  cnbc: { label: 'CNBC', color: '#005594' },
  marketwatch: { label: 'MarketWatch', color: '#00ac4e' },
  bloomberg_markets: { label: 'Bloomberg', color: '#472ea4' },
  yahoo_finance: { label: 'Yahoo Finance', color: '#6001d2' },
  google_news_economy: { label: 'Google News', color: '#4285f4' },
};

export function getSourceInfo(sourceId) {
  return NEWS_SOURCE_LOGOS[sourceId] || { label: sourceId || 'News', color: '#8b949e' };
}
