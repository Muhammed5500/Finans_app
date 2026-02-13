import { Sentiment } from './newsTypes';

const POSITIVE_KEYWORDS = [
  // English
  'rally', 'surge', 'gain', 'rise', 'bull', 'record high', 'breakout',
  'growth', 'profit', 'upgrade', 'beat', 'soar', 'outperform', 'milestone',
  'boom', 'recovery', 'optimism', 'bullish', 'up', 'higher', 'strong',
  // Turkish
  'yukselis', 'yükseliş', 'artis', 'artış', 'rekor', 'kazanc', 'kazanç',
  'büyüme', 'kar', 'iyimser', 'güçlü', 'olumlu', 'ralli', 'toparlanma',
];

const NEGATIVE_KEYWORDS = [
  // English
  'crash', 'plunge', 'drop', 'fall', 'bear', 'loss', 'decline', 'sell-off',
  'crisis', 'downturn', 'recession', 'default', 'bankruptcy', 'downgrade',
  'miss', 'slump', 'fear', 'bearish', 'down', 'lower', 'weak', 'warning',
  // Turkish
  'dusus', 'düşüş', 'kayip', 'kayıp', 'kriz', 'gerileme', 'daralma',
  'iflas', 'zarar', 'karamsar', 'zayıf', 'olumsuz', 'endise', 'endişe',
  'çöküş', 'satis', 'satış', 'baskı',
];

export function scoreSentiment(title: string, summary?: string): Sentiment {
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
