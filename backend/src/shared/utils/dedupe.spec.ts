import { NewsSource } from '@prisma/client';
import { NormalizedNewsItem } from '../types';
import { dedupeByUrl, urlExists, createUrlSet, filterNewUrls } from './dedupe';

describe('dedupeByUrl', () => {
  const createItem = (
    url: string,
    publishedAt: Date,
    sourceId?: string,
  ): NormalizedNewsItem => ({
    source: NewsSource.GDELT,
    sourceId,
    title: `Title for ${url}`,
    url,
    publishedAt,
    discoveredAt: new Date(),
    raw: { original: url },
  });

  describe('basic deduplication', () => {
    it('should return empty result for empty array', () => {
      const result = dedupeByUrl([]);
      expect(result.unique).toHaveLength(0);
      expect(result.totalProcessed).toBe(0);
      expect(result.duplicatesFound).toBe(0);
    });

    it('should return single item unchanged', () => {
      const item = createItem(
        'https://example.com/article',
        new Date('2024-01-15'),
        'src-1',
      );

      const result = dedupeByUrl([item]);

      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].url).toBe(item.url);
      expect(result.duplicatesFound).toBe(0);
    });

    it('should keep items with different URLs', () => {
      const items = [
        createItem('https://example.com/article1', new Date('2024-01-15')),
        createItem('https://example.com/article2', new Date('2024-01-16')),
        createItem('https://example.com/article3', new Date('2024-01-17')),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique).toHaveLength(3);
      expect(result.duplicatesFound).toBe(0);
    });
  });

  describe('duplicate merging', () => {
    it('should merge duplicates with same canonical URL', () => {
      const items = [
        createItem(
          'https://example.com/article?utm_source=twitter',
          new Date('2024-01-15'),
        ),
        createItem('https://www.example.com/article/', new Date('2024-01-16')),
        createItem(
          'http://EXAMPLE.COM/article#section',
          new Date('2024-01-17'),
        ),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique).toHaveLength(1);
      expect(result.duplicatesFound).toBe(2);
      expect(result.duplicateUrls).toHaveLength(1);
    });

    it('should keep item with earliest publishedAt', () => {
      const earliest = new Date('2024-01-01');
      const middle = new Date('2024-01-15');
      const latest = new Date('2024-01-30');

      const items = [
        createItem(
          'https://example.com/article?utm_source=twitter',
          middle,
          'src-2',
        ),
        createItem(
          'https://example.com/article?utm_source=facebook',
          latest,
          'src-3',
        ),
        createItem(
          'https://example.com/article?utm_source=email',
          earliest,
          'src-1',
        ),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].publishedAt).toEqual(earliest);
      expect(result.unique[0].sourceId).toBe('src-1');
    });

    it('should merge sourceIds from duplicates', () => {
      const items = [
        createItem(
          'https://example.com/article',
          new Date('2024-01-01'),
          'src-1',
        ),
        createItem(
          'https://example.com/article',
          new Date('2024-01-02'),
          'src-2',
        ),
        createItem(
          'https://example.com/article',
          new Date('2024-01-03'),
          'src-3',
        ),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].mergedSourceIds).toContain('src-1');
      expect(result.unique[0].mergedSourceIds).toContain('src-2');
      expect(result.unique[0].mergedSourceIds).toContain('src-3');
    });

    it('should track duplicate count', () => {
      const items = [
        createItem('https://example.com/article', new Date('2024-01-01')),
        createItem('https://example.com/article', new Date('2024-01-02')),
        createItem('https://example.com/article', new Date('2024-01-03')),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique[0].duplicateCount).toBe(2);
    });

    it('should collect all discoveredAt timestamps', () => {
      const items = [
        createItem('https://example.com/article', new Date('2024-01-01')),
        createItem('https://example.com/article', new Date('2024-01-02')),
      ];
      items[0].discoveredAt = new Date('2024-01-01T10:00:00Z');
      items[1].discoveredAt = new Date('2024-01-02T10:00:00Z');

      const result = dedupeByUrl(items);

      expect(result.unique[0].mergedDiscoveredAt).toHaveLength(2);
    });

    it('should merge raw metadata', () => {
      const items = [
        createItem('https://example.com/article', new Date('2024-01-01')),
        createItem('https://example.com/article', new Date('2024-01-02')),
      ];
      items[0].raw = { key1: 'value1' };
      items[1].raw = { key2: 'value2' };

      const result = dedupeByUrl(items);

      expect(result.unique[0].raw.key1).toBe('value1');
      // key2 might or might not be present depending on merge strategy
      expect(result.unique[0].raw._duplicates).toBeDefined();
    });
  });

  describe('statistics', () => {
    it('should count total processed', () => {
      const items = [
        createItem('https://example.com/article1', new Date('2024-01-01')),
        createItem('https://example.com/article1', new Date('2024-01-02')),
        createItem('https://example.com/article2', new Date('2024-01-03')),
      ];

      const result = dedupeByUrl(items);

      expect(result.totalProcessed).toBe(3);
    });

    it('should count duplicates found', () => {
      const items = [
        createItem('https://example.com/a', new Date('2024-01-01')),
        createItem('https://example.com/a', new Date('2024-01-02')),
        createItem('https://example.com/a', new Date('2024-01-03')),
        createItem('https://example.com/b', new Date('2024-01-04')),
        createItem('https://example.com/b', new Date('2024-01-05')),
      ];

      const result = dedupeByUrl(items);

      expect(result.unique).toHaveLength(2);
      expect(result.duplicatesFound).toBe(3); // 2 for 'a', 1 for 'b'
    });

    it('should list duplicate URLs', () => {
      const items = [
        createItem('https://example.com/dup1', new Date('2024-01-01')),
        createItem('https://example.com/dup1', new Date('2024-01-02')),
        createItem('https://example.com/unique', new Date('2024-01-03')),
        createItem('https://example.com/dup2', new Date('2024-01-04')),
        createItem('https://example.com/dup2', new Date('2024-01-05')),
      ];

      const result = dedupeByUrl(items);

      expect(result.duplicateUrls).toHaveLength(2);
      expect(result.duplicateUrls).toContain('https://example.com/dup1');
      expect(result.duplicateUrls).toContain('https://example.com/dup2');
    });
  });
});

describe('urlExists', () => {
  it('should return true for existing URL', () => {
    const urls = new Set(['https://example.com/article']);
    expect(urlExists('https://example.com/article', urls)).toBe(true);
  });

  it('should return false for new URL', () => {
    const urls = new Set(['https://example.com/article']);
    expect(urlExists('https://example.com/other', urls)).toBe(false);
  });

  it('should match canonicalized URLs', () => {
    const urls = new Set(['https://example.com/article']);
    expect(
      urlExists('https://www.example.com/article?utm_source=test', urls),
    ).toBe(true);
  });
});

describe('createUrlSet', () => {
  it('should create set of canonical URLs', () => {
    const items = [
      { url: 'https://example.com/a' },
      { url: 'https://www.example.com/b/' },
      { url: 'http://EXAMPLE.COM/c' },
    ];

    const set = createUrlSet(items);

    expect(set.size).toBe(3);
    expect(set.has('https://example.com/a')).toBe(true);
    expect(set.has('https://example.com/b')).toBe(true);
    expect(set.has('https://example.com/c')).toBe(true);
  });

  it('should dedupe canonical URLs in set', () => {
    const items = [
      { url: 'https://example.com/article' },
      { url: 'https://www.example.com/article/' },
      { url: 'http://example.com/article?utm_source=test' },
    ];

    const set = createUrlSet(items);

    expect(set.size).toBe(1);
  });
});

describe('filterNewUrls', () => {
  it('should filter out existing URLs', () => {
    const items = [
      { url: 'https://example.com/existing', title: 'Existing' },
      { url: 'https://example.com/new', title: 'New' },
    ];
    const existing = new Set(['https://example.com/existing']);

    const filtered = filterNewUrls(items, existing);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('New');
  });

  it('should handle canonical URL matching', () => {
    const items = [
      {
        url: 'https://www.example.com/existing?utm_source=test',
        title: 'Existing',
      },
      { url: 'https://example.com/new', title: 'New' },
    ];
    const existing = new Set(['https://example.com/existing']);

    const filtered = filterNewUrls(items, existing);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('New');
  });

  it('should return empty array if all exist', () => {
    const items = [
      { url: 'https://example.com/a', title: 'A' },
      { url: 'https://example.com/b', title: 'B' },
    ];
    const existing = new Set([
      'https://example.com/a',
      'https://example.com/b',
    ]);

    const filtered = filterNewUrls(items, existing);

    expect(filtered).toHaveLength(0);
  });

  it('should return all if none exist', () => {
    const items = [
      { url: 'https://example.com/a', title: 'A' },
      { url: 'https://example.com/b', title: 'B' },
    ];
    const existing = new Set<string>();

    const filtered = filterNewUrls(items, existing);

    expect(filtered).toHaveLength(2);
  });
});
