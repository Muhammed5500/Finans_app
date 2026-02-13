import {
  canonicalizeUrl,
  hashIdFromUrl,
  safeDateParse,
  normalizeTitle,
  truncateSummary,
} from './normalize';

describe('canonicalizeUrl', () => {
  describe('basic normalization', () => {
    it('should lowercase hostname', () => {
      expect(canonicalizeUrl('https://WWW.EXAMPLE.COM/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should remove www. prefix', () => {
      expect(canonicalizeUrl('https://www.example.com/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should normalize to https', () => {
      expect(canonicalizeUrl('http://example.com/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should add https if protocol missing', () => {
      expect(canonicalizeUrl('example.com/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should remove trailing slash', () => {
      expect(canonicalizeUrl('https://example.com/path/')).toBe(
        'https://example.com/path',
      );
    });

    it('should keep root path slash', () => {
      expect(canonicalizeUrl('https://example.com/')).toBe(
        'https://example.com/',
      );
    });

    it('should remove default ports', () => {
      expect(canonicalizeUrl('https://example.com:443/path')).toBe(
        'https://example.com/path',
      );
      expect(canonicalizeUrl('http://example.com:80/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should remove fragments', () => {
      expect(canonicalizeUrl('https://example.com/path#section')).toBe(
        'https://example.com/path',
      );
    });
  });

  describe('tracking parameter removal', () => {
    it('should remove utm parameters', () => {
      const url =
        'https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=test';
      expect(canonicalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove fbclid', () => {
      const url = 'https://example.com/article?fbclid=abc123';
      expect(canonicalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove gclid', () => {
      const url = 'https://example.com/article?gclid=xyz789';
      expect(canonicalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove multiple tracking params', () => {
      const url =
        'https://example.com/article?fbclid=fb&gclid=gc&utm_source=src&ref=ref';
      expect(canonicalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should keep non-tracking params', () => {
      const url = 'https://example.com/search?q=test&page=2&utm_source=twitter';
      expect(canonicalizeUrl(url)).toBe(
        'https://example.com/search?page=2&q=test',
      );
    });

    it('should sort remaining query params', () => {
      const url = 'https://example.com/search?z=1&a=2&m=3';
      expect(canonicalizeUrl(url)).toBe(
        'https://example.com/search?a=2&m=3&z=1',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(canonicalizeUrl('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(canonicalizeUrl(null as any)).toBe(null);
      expect(canonicalizeUrl(undefined as any)).toBe(undefined);
    });

    it('should handle invalid URL gracefully', () => {
      // Invalid URLs are returned as-is
      expect(canonicalizeUrl('not a url')).toBe('not a url');
    });

    it('should handle URL with special characters', () => {
      const url = 'https://example.com/path/with%20spaces';
      expect(canonicalizeUrl(url)).toBe(
        'https://example.com/path/with%20spaces',
      );
    });
  });

  describe('real-world URLs', () => {
    it('should canonicalize Bloomberg URL', () => {
      const url =
        'https://www.bloomberg.com/news/articles/2024-01-15/stock-market?utm_source=google&utm_medium=cpc';
      expect(canonicalizeUrl(url)).toBe(
        'https://bloomberg.com/news/articles/2024-01-15/stock-market',
      );
    });

    it('should canonicalize Reuters URL', () => {
      const url =
        'http://WWW.Reuters.COM/article/us-stocks/?fbclid=abc#comments';
      expect(canonicalizeUrl(url)).toBe(
        'https://reuters.com/article/us-stocks',
      );
    });

    it('should produce same result for equivalent URLs', () => {
      const urls = [
        'https://example.com/article?utm_source=twitter',
        'http://www.example.com/article/',
        'https://EXAMPLE.COM/article#section',
        'example.com/article?fbclid=abc',
      ];

      const canonical = canonicalizeUrl(urls[0]);
      for (const url of urls) {
        expect(canonicalizeUrl(url)).toBe(canonical);
      }
    });
  });
});

describe('hashIdFromUrl', () => {
  it('should return 16 character hex string', () => {
    const hash = hashIdFromUrl('https://example.com/article');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should return same hash for equivalent URLs', () => {
    const urls = [
      'https://example.com/article?utm_source=twitter',
      'http://www.example.com/article/',
      'https://EXAMPLE.COM/article#section',
    ];

    const firstHash = hashIdFromUrl(urls[0]);
    for (const url of urls) {
      expect(hashIdFromUrl(url)).toBe(firstHash);
    }
  });

  it('should return different hash for different URLs', () => {
    const hash1 = hashIdFromUrl('https://example.com/article1');
    const hash2 = hashIdFromUrl('https://example.com/article2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    expect(hashIdFromUrl('')).toBe('');
  });
});

describe('safeDateParse', () => {
  describe('Date objects', () => {
    it('should return valid Date as-is', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(safeDateParse(date)).toEqual(date);
    });

    it('should return fallback for invalid Date', () => {
      const fallback = new Date('2024-01-01');
      expect(safeDateParse(new Date('invalid'), fallback)).toEqual(fallback);
    });
  });

  describe('ISO 8601 strings', () => {
    it('should parse ISO 8601 with timezone', () => {
      const result = safeDateParse('2024-01-15T16:30:00Z');
      expect(result.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });

    it('should parse ISO 8601 with offset', () => {
      const result = safeDateParse('2024-01-15T16:30:00+03:00');
      expect(result.toISOString()).toBe('2024-01-15T13:30:00.000Z');
    });

    it('should parse date only', () => {
      const result = safeDateParse('2024-01-15');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });
  });

  describe('GDELT format', () => {
    it('should parse GDELT format with T and Z', () => {
      const result = safeDateParse('20240115T163000Z');
      expect(result.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });

    it('should parse GDELT format without T and Z', () => {
      const result = safeDateParse('20240115163000');
      expect(result.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });
  });

  describe('Unix timestamps', () => {
    it('should parse seconds timestamp', () => {
      // 1705338600 = 2024-01-15T17:10:00Z
      const result = safeDateParse(1705338600);
      expect(result.toISOString()).toBe('2024-01-15T17:10:00.000Z');
    });

    it('should parse milliseconds timestamp', () => {
      const result = safeDateParse(1705338600000);
      expect(result.toISOString()).toBe('2024-01-15T17:10:00.000Z');
    });

    it('should parse timestamp string', () => {
      const result = safeDateParse('1705338600');
      expect(result.toISOString()).toBe('2024-01-15T17:10:00.000Z');
    });
  });

  describe('European format', () => {
    it('should parse DD.MM.YYYY', () => {
      const result = safeDateParse('15.01.2024');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it('should parse DD/MM/YYYY', () => {
      const result = safeDateParse('15/01/2024');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('edge cases', () => {
    it('should return fallback for null', () => {
      const fallback = new Date('2024-01-01');
      expect(safeDateParse(null, fallback)).toEqual(fallback);
    });

    it('should return fallback for undefined', () => {
      const fallback = new Date('2024-01-01');
      expect(safeDateParse(undefined, fallback)).toEqual(fallback);
    });

    it('should return fallback for empty string', () => {
      const fallback = new Date('2024-01-01');
      expect(safeDateParse('', fallback)).toEqual(fallback);
    });

    it('should return fallback for unparseable string', () => {
      const fallback = new Date('2024-01-01');
      expect(safeDateParse('not a date', fallback)).toEqual(fallback);
    });

    it('should use current time as default fallback', () => {
      const before = Date.now();
      const result = safeDateParse('not a date');
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });
});

describe('normalizeTitle', () => {
  it('should strip HTML tags', () => {
    expect(normalizeTitle('<b>Bold</b> text')).toBe('Bold text');
  });

  it('should decode HTML entities', () => {
    expect(normalizeTitle('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(normalizeTitle('&lt;script&gt;')).toBe('<script>');
  });

  it('should normalize whitespace', () => {
    expect(normalizeTitle('Multiple   spaces\n\tnewlines')).toBe(
      'Multiple spaces newlines',
    );
  });

  it('should trim', () => {
    expect(normalizeTitle('  padded  ')).toBe('padded');
  });

  it('should handle empty/null', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle(null as any)).toBe('');
  });
});

describe('truncateSummary', () => {
  it('should not truncate short text', () => {
    expect(truncateSummary('Short text', 100)).toBe('Short text');
  });

  it('should truncate at word boundary', () => {
    const text = 'This is a longer text that needs truncation';
    const result = truncateSummary(text, 25);
    expect(result).toBe('This is a longer text...');
    expect(result!.length).toBeLessThanOrEqual(28); // 25 + '...'
  });

  it('should handle null/undefined', () => {
    expect(truncateSummary(null)).toBeUndefined();
    expect(truncateSummary(undefined)).toBeUndefined();
  });

  it('should clean HTML before truncating', () => {
    const text = '<p>Some <b>HTML</b> content</p>';
    expect(truncateSummary(text, 100)).toBe('Some HTML content');
  });
});
