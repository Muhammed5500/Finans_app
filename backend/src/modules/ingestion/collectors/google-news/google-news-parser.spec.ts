import {
  buildGoogleNewsRssUrl,
  buildGoogleNewsTurkishRssUrl,
  parseGoogleNewsRss,
  parseGoogleNewsDate,
  isValidGoogleNewsItem,
  cleanTitle,
  extractSourceInfo,
  detectLanguage,
} from './google-news-parser';
import { GoogleNewsRssItem } from './google-news.types';

describe('Google News RSS Parser', () => {
  describe('buildGoogleNewsRssUrl', () => {
    it('should build correct URL with default parameters', () => {
      const url = buildGoogleNewsRssUrl('BIST');

      expect(url).toBe(
        'https://news.google.com/rss/search?q=BIST&hl=en-US&gl=US&ceid=US:en',
      );
    });

    it('should encode query parameters', () => {
      const url = buildGoogleNewsRssUrl('Tesla stock');

      expect(url).toContain('q=Tesla%20stock');
    });

    it('should use custom language/region parameters', () => {
      const url = buildGoogleNewsRssUrl('test', 'tr', 'TR', 'TR:tr');

      expect(url).toBe(
        'https://news.google.com/rss/search?q=test&hl=tr&gl=TR&ceid=TR:tr',
      );
    });
  });

  describe('buildGoogleNewsTurkishRssUrl', () => {
    it('should build Turkish Google News URL', () => {
      const url = buildGoogleNewsTurkishRssUrl('THYAO');

      expect(url).toBe(
        'https://news.google.com/rss/search?q=THYAO&hl=tr&gl=TR&ceid=TR:tr',
      );
    });
  });

  describe('parseGoogleNewsRss', () => {
    const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BIST - Google News</title>
    <link>https://news.google.com</link>
    <description>Google News</description>
    <item>
      <title>BIST 100 rallies on positive economic data - Reuters</title>
      <link>https://news.google.com/rss/articles/CBMiWmh0dHBzOi8vd3d3LnJldXRlcnMuY29tL2J1c2luZXNzL2Jpc3QtMTAwLXJhbGxpZXMtb24tcG9zaXRpdmUtZWNvbm9taWMtZGF0YS0yMDI0LTAxLTE1L9IBAA?oc=5</link>
      <guid isPermaLink="false">CBMiWmh0dHBzOi8vd3d3LnJldXRlcnMuY29t</guid>
      <pubDate>Mon, 15 Jan 2024 16:30:00 GMT</pubDate>
      <description><![CDATA[<a href="https://www.reuters.com">Reuters</a>]]></description>
      <source url="https://www.reuters.com">Reuters</source>
    </item>
    <item>
      <title>Turkish stocks gain amid rate expectations - Bloomberg</title>
      <link>https://news.google.com/rss/articles/CBMiYmh0dHBzOi8vd3d3LmJsb29tYmVyZy5jb20vbmV3cy9hcnRpY2xlcy8yMDI0LTAxLTE1L3R1cmtpc2gtc3RvY2tzLWdhaW4tYW1pZC1yYXRlLWV4cGVjdGF0aW9uc9IBAA?oc=5</link>
      <guid isPermaLink="false">CBMiYmh0dHBzOi8vd3d3LmJsb29tYmVyZy5jb20</guid>
      <pubDate>Mon, 15 Jan 2024 14:00:00 GMT</pubDate>
      <description><![CDATA[<a href="https://www.bloomberg.com">Bloomberg</a>]]></description>
      <source url="https://www.bloomberg.com">Bloomberg</source>
    </item>
  </channel>
</rss>`;

    it('should parse RSS feed correctly', () => {
      const items = parseGoogleNewsRss(sampleRss);

      expect(items).toHaveLength(2);
      expect(items[0].title).toContain('BIST 100 rallies');
      expect(items[0].link).toContain('news.google.com');
      expect(items[0].source).toBe('Reuters');
    });

    it('should parse pubDate correctly', () => {
      const items = parseGoogleNewsRss(sampleRss);

      expect(items[0].pubDate).toBe('Mon, 15 Jan 2024 16:30:00 GMT');
    });

    it('should parse guid', () => {
      const items = parseGoogleNewsRss(sampleRss);

      expect(items[0].guid).toBe('CBMiWmh0dHBzOi8vd3d3LnJldXRlcnMuY29t');
    });

    it('should parse description with CDATA', () => {
      const items = parseGoogleNewsRss(sampleRss);

      expect(items[0].description).toContain('Reuters');
    });

    it('should handle single item (not array)', () => {
      const singleItemRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>Single Item</title>
      <link>https://example.com</link>
      <pubDate>Mon, 15 Jan 2024 16:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

      const items = parseGoogleNewsRss(singleItemRss);

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Single Item');
    });

    it('should handle empty feed', () => {
      const emptyRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

      const items = parseGoogleNewsRss(emptyRss);

      expect(items).toHaveLength(0);
    });

    it('should handle invalid XML gracefully', () => {
      // Parser doesn't throw on invalid XML, returns empty array
      const items = parseGoogleNewsRss('not xml');
      expect(items).toHaveLength(0);
    });
  });

  describe('parseGoogleNewsDate', () => {
    it('should parse RFC 2822 date', () => {
      const date = parseGoogleNewsDate('Mon, 15 Jan 2024 16:30:00 GMT');

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(16);
    });

    it('should parse ISO 8601 date', () => {
      const date = parseGoogleNewsDate('2024-01-15T16:30:00Z');

      expect(date.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });

    it('should return current date for invalid input', () => {
      const before = Date.now();
      const date = parseGoogleNewsDate('invalid');
      const after = Date.now();

      expect(date.getTime()).toBeGreaterThanOrEqual(before);
      expect(date.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle empty string', () => {
      const date = parseGoogleNewsDate('');

      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('cleanTitle', () => {
    it('should decode HTML entities', () => {
      expect(cleanTitle('Tesla &amp; SpaceX')).toBe('Tesla & SpaceX');
      // Note: After decoding &lt; and &gt; they become < and > which are HTML tags
      // and get stripped by the tag remover. This is expected behavior.
      expect(cleanTitle('Price &gt; 100')).toBe('Price > 100');
      expect(cleanTitle('He said &quot;hello&quot;')).toBe('He said "hello"');
      expect(cleanTitle('It&#39;s working')).toBe("It's working");
    });

    it('should strip HTML tags', () => {
      expect(cleanTitle('<b>Bold</b> text')).toBe('Bold text');
      expect(cleanTitle('<a href="x">Link</a>')).toBe('Link');
    });

    it('should normalize whitespace', () => {
      expect(cleanTitle('Multiple   spaces')).toBe('Multiple spaces');
      expect(cleanTitle('  Leading and trailing  ')).toBe(
        'Leading and trailing',
      );
    });

    it('should handle empty input', () => {
      expect(cleanTitle('')).toBe('');
      expect(cleanTitle(null as any)).toBe('');
    });
  });

  describe('extractSourceInfo', () => {
    it('should extract source name from anchor', () => {
      const info = extractSourceInfo(
        '<a href="https://reuters.com">Reuters</a>',
      );

      expect(info.name).toBe('Reuters');
      expect(info.originalUrl).toBe('https://reuters.com');
    });

    it('should handle description without anchor', () => {
      const info = extractSourceInfo('Plain text description');

      expect(info.name).toBe('');
    });

    it('should handle empty description', () => {
      const info = extractSourceInfo('');

      expect(info.name).toBe('');
    });

    it('should extract URL from anchor', () => {
      const info = extractSourceInfo(
        '<a href="https://example.com/article">Source</a>',
      );

      expect(info.originalUrl).toBe('https://example.com/article');
    });
  });

  describe('detectLanguage', () => {
    it('should detect Turkish from URL', () => {
      expect(detectLanguage('https://news.google.com/rss?hl=tr', 'Test')).toBe(
        'tr',
      );
      expect(
        detectLanguage('https://news.google.com/rss?ceid=TR:tr', 'Test'),
      ).toBe('tr');
    });

    it('should detect English from URL', () => {
      expect(detectLanguage('https://news.google.com/rss?hl=en', 'Test')).toBe(
        'en',
      );
      expect(
        detectLanguage('https://news.google.com/rss?ceid=US:en', 'Test'),
      ).toBe('en');
    });

    it('should detect Turkish from title characters', () => {
      expect(detectLanguage('https://example.com', 'Türkiye ekonomisi')).toBe(
        'tr',
      );
      expect(detectLanguage('https://example.com', 'İstanbul borsası')).toBe(
        'tr',
      );
      expect(detectLanguage('https://example.com', 'Şirket haberleri')).toBe(
        'tr',
      );
    });

    it('should default to English', () => {
      expect(
        detectLanguage('https://example.com', 'Regular English title'),
      ).toBe('en');
    });
  });

  describe('isValidGoogleNewsItem', () => {
    it('should return true for valid item', () => {
      const item: GoogleNewsRssItem = {
        title: 'Test Title',
        link: 'https://example.com',
        pubDate: '2024-01-15',
      };

      expect(isValidGoogleNewsItem(item)).toBe(true);
    });

    it('should return false for missing title', () => {
      const item: GoogleNewsRssItem = {
        title: '',
        link: 'https://example.com',
        pubDate: '2024-01-15',
      };

      expect(isValidGoogleNewsItem(item)).toBe(false);
    });

    it('should return false for missing link', () => {
      const item: GoogleNewsRssItem = {
        title: 'Test',
        link: '',
        pubDate: '2024-01-15',
      };

      expect(isValidGoogleNewsItem(item)).toBe(false);
    });
  });

  describe('Real-world Google News RSS scenarios', () => {
    it('should handle typical Google News response structure', () => {
      const realWorldRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <generator>NFE/5.0</generator>
    <title>"TUPRS" - Google News</title>
    <link>https://news.google.com/search?q=TUPRS</link>
    <language>en</language>
    <webMaster>news-webmaster@google.com</webMaster>
    <copyright>2024 Google Inc.</copyright>
    <lastBuildDate>Mon, 15 Jan 2024 18:00:00 GMT</lastBuildDate>
    <item>
      <title>Tüpraş reports Q4 earnings beat - Investing.com</title>
      <link>https://news.google.com/rss/articles/CBMiXXh0dHBzOi8vd3d3Lmludm...</link>
      <guid isPermaLink="false">CBMiXXh0dHBzOi8vd3d3Lmludm</guid>
      <pubDate>Mon, 15 Jan 2024 17:00:00 GMT</pubDate>
      <description>&lt;a href=&quot;https://www.investing.com&quot;&gt;Investing.com&lt;/a&gt;</description>
      <source url="https://www.investing.com">Investing.com</source>
    </item>
  </channel>
</rss>`;

      const items = parseGoogleNewsRss(realWorldRss);

      expect(items).toHaveLength(1);
      expect(items[0].title).toContain('Tüpraş');
      expect(items[0].source).toBe('Investing.com');
    });

    it('should handle Turkish Google News response', () => {
      const turkishRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"BIST" - Google Haberler</title>
    <link>https://news.google.com/search?q=BIST&amp;hl=tr&amp;gl=TR</link>
    <item>
      <title>BIST 100 güne yükselişle başladı - Dünya Gazetesi</title>
      <link>https://news.google.com/rss/articles/...</link>
      <pubDate>Mon, 15 Jan 2024 09:00:00 GMT</pubDate>
      <source>Dünya Gazetesi</source>
    </item>
  </channel>
</rss>`;

      const items = parseGoogleNewsRss(turkishRss);

      expect(items).toHaveLength(1);
      expect(items[0].title).toContain('BIST 100');
      expect(items[0].source).toBe('Dünya Gazetesi');
    });
  });
});
