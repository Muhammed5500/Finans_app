import { NewsItem } from './newsTypes';

// ─── Stop Words ──────────────────────────────────────────────────────────────

const STOP_WORDS_EN = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall', 'it', 'its',
  'this', 'that', 'these', 'those', 'not', 'no', 'as', 'if', 'so',
  'than', 'too', 'very', 'just', 'about', 'up', 'out', 'into',
]);

const STOP_WORDS_TR = new Set([
  've', 'ile', 'bir', 'bu', 'da', 'de', 'den', 'dan', 'için', 'var',
  'yok', 'ne', 'mi', 'mu', 'mü', 'mı', 'ama', 'fakat', 'ancak',
  'hem', 'ya', 'veya', 'ki', 'daha', 'en', 'gibi', 'kadar', 'sonra',
  'önce', 'şu', 'o', 'ben', 'sen', 'biz', 'siz', 'olan', 'olarak',
]);

const ALL_STOP_WORDS = new Set([...STOP_WORDS_EN, ...STOP_WORDS_TR]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // remove punctuation, keep Unicode letters & digits
    .replace(/\s+/g, ' ')
    .trim();
}

function toWordSet(text: string): Set<string> {
  const normalized = normalizeTitle(text);
  const words = normalized.split(' ').filter(w => w.length > 1 && !ALL_STOP_WORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.6;

export function deduplicateNews(items: NewsItem[]): NewsItem[] {
  if (items.length <= 1) return items;

  const wordSets = items.map(item => toWordSet(item.title));
  const kept: boolean[] = new Array(items.length).fill(true);

  for (let i = 0; i < items.length; i++) {
    if (!kept[i]) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (!kept[j]) continue;
      const similarity = jaccardSimilarity(wordSets[i], wordSets[j]);
      if (similarity >= SIMILARITY_THRESHOLD) {
        // Keep the one with longer summary (more content)
        const iLen = (items[i].summary || '').length;
        const jLen = (items[j].summary || '').length;
        if (jLen > iLen) {
          kept[i] = false;
          break;
        } else {
          kept[j] = false;
        }
      }
    }
  }

  return items.filter((_, i) => kept[i]);
}
