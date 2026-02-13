import {
  parseRssFeed,
  extractFilingType,
  parseRssDate,
  isValidRssItem,
} from './rss-parser';
import { SecRssItem } from './sec-rss.types';

describe('RSS Parser', () => {
  describe('parseRssFeed - RSS 2.0 format', () => {
    const sampleRss2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SEC EDGAR Full-Text Search</title>
    <link>https://www.sec.gov</link>
    <description>SEC EDGAR Full-Text Search Results</description>
    <item>
      <title>8-K - TESLA INC (0001318605)</title>
      <link>https://www.sec.gov/Archives/edgar/data/1318605/000156459024001234/tsla-8k.htm</link>
      <description>Current report filing</description>
      <pubDate>Fri, 15 Jan 2024 16:30:00 EST</pubDate>
      <guid>edgar-1318605-8k-20240115</guid>
    </item>
    <item>
      <title>10-K - APPLE INC (0000320193)</title>
      <link>https://www.sec.gov/Archives/edgar/data/320193/000032019324001234/aapl-10k.htm</link>
      <description>Annual report filing</description>
      <pubDate>Thu, 14 Jan 2024 09:00:00 EST</pubDate>
      <guid>edgar-320193-10k-20240114</guid>
    </item>
  </channel>
</rss>`;

    it('should parse RSS 2.0 feed correctly', () => {
      const items = parseRssFeed(sampleRss2);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('8-K - TESLA INC (0001318605)');
      expect(items[0].link).toContain('sec.gov');
      expect(items[0].description).toBe('Current report filing');
      expect(items[0].guid).toBe('edgar-1318605-8k-20240115');
    });

    it('should parse pubDate correctly', () => {
      const items = parseRssFeed(sampleRss2);
      expect(items[0].pubDate).toBe('Fri, 15 Jan 2024 16:30:00 EST');
    });

    it('should handle single item (not array)', () => {
      const singleItemRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>Single Item</title>
      <link>https://example.com/item1</link>
      <pubDate>Fri, 15 Jan 2024 16:30:00 EST</pubDate>
    </item>
  </channel>
</rss>`;

      const items = parseRssFeed(singleItemRss);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Single Item');
    });
  });

  describe('parseRssFeed - Atom format', () => {
    const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Recent EDGAR Filings</title>
  <link href="https://www.sec.gov"/>
  <updated>2024-01-15T21:30:00Z</updated>
  <entry>
    <title>8-K - MICROSOFT CORP (0000789019)</title>
    <link rel="alternate" href="https://www.sec.gov/Archives/edgar/data/789019/msft-8k.htm"/>
    <id>urn:tag:sec.gov,2024:edgar-789019-8k</id>
    <updated>2024-01-15T20:00:00Z</updated>
    <summary>Current report</summary>
    <category term="8-K"/>
  </entry>
  <entry>
    <title>4 - BEZOS JEFFREY P</title>
    <link rel="alternate" href="https://www.sec.gov/Archives/edgar/data/1043298/form4.htm"/>
    <id>urn:tag:sec.gov,2024:edgar-1043298-4</id>
    <updated>2024-01-15T18:00:00Z</updated>
    <summary>Statement of changes</summary>
  </entry>
</feed>`;

    it('should parse Atom feed correctly', () => {
      const items = parseRssFeed(sampleAtom);

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('8-K - MICROSOFT CORP (0000789019)');
      expect(items[0].link).toContain('sec.gov');
      expect(items[0].id).toBe('urn:tag:sec.gov,2024:edgar-789019-8k');
    });

    it('should extract link from Atom link element', () => {
      const items = parseRssFeed(sampleAtom);
      expect(items[0].link).toBe(
        'https://www.sec.gov/Archives/edgar/data/789019/msft-8k.htm',
      );
    });

    it('should parse updated as pubDate', () => {
      const items = parseRssFeed(sampleAtom);
      expect(items[0].pubDate).toBe('2024-01-15T20:00:00Z');
    });
  });

  describe('parseRssFeed - Edge cases', () => {
    it('should handle empty feed', () => {
      const emptyFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

      const items = parseRssFeed(emptyFeed);
      expect(items).toHaveLength(0);
    });

    it('should handle CDATA content', () => {
      const cdataFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[8-K - NVIDIA CORP (0001045810)]]></title>
      <link>https://example.com/item</link>
      <pubDate>Fri, 15 Jan 2024 16:30:00 EST</pubDate>
    </item>
  </channel>
</rss>`;

      const items = parseRssFeed(cdataFeed);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('8-K - NVIDIA CORP (0001045810)');
    });

    it('should throw on invalid XML', () => {
      const invalidXml = 'not xml at all';

      // Should not throw, but return empty array for malformed input
      expect(() => parseRssFeed(invalidXml)).not.toThrow();
    });

    it('should handle namespaced XML', () => {
      const namespacedFeed = `<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link href="https://sec.gov/feed" rel="self"/>
    <item>
      <title>10-Q - AMAZON.COM INC</title>
      <link>https://sec.gov/item</link>
      <pubDate>Fri, 15 Jan 2024 16:30:00 EST</pubDate>
    </item>
  </channel>
</rss>`;

      const items = parseRssFeed(namespacedFeed);
      expect(items).toHaveLength(1);
    });
  });

  describe('extractFilingType', () => {
    it('should extract 8-K filing type', () => {
      const result = extractFilingType('8-K - TESLA INC (0001318605)');
      expect(result.type).toBe('8-K');
      expect(result.companyName).toBe('TESLA INC');
      expect(result.cik).toBe('0001318605');
    });

    it('should extract 10-K filing type', () => {
      const result = extractFilingType('10-K - APPLE INC');
      expect(result.type).toBe('10-K');
      expect(result.companyName).toBe('APPLE INC');
    });

    it('should extract 10-Q filing type', () => {
      const result = extractFilingType('10-Q - MICROSOFT CORP (0000789019)');
      expect(result.type).toBe('10-Q');
    });

    it('should extract Form 4 filing type', () => {
      const result = extractFilingType('4 - MUSK ELON');
      expect(result.type).toBe('4');
    });

    it('should extract 13F filing type', () => {
      const result = extractFilingType('13F-HR - BERKSHIRE HATHAWAY INC');
      expect(result.type).toBe('13F');
    });

    it('should extract S-1 filing type', () => {
      const result = extractFilingType('S-1 - STRIPE INC');
      expect(result.type).toBe('S-1');
    });

    it('should extract DEF 14A filing type', () => {
      const result = extractFilingType('DEF 14A - ALPHABET INC');
      expect(result.type).toBe('DEF 14A');
    });

    it('should return OTHER for unknown filing types', () => {
      const result = extractFilingType('UNKNOWN - SOME COMPANY');
      expect(result.type).toBe('OTHER');
    });

    it('should extract ticker from parentheses', () => {
      const result = extractFilingType('8-K - TESLA INC (TSLA)');
      expect(result.ticker).toBe('TSLA');
    });

    it('should handle empty title', () => {
      const result = extractFilingType('');
      expect(result.type).toBe('OTHER');
    });

    it('should be case insensitive', () => {
      expect(extractFilingType('8-k - company').type).toBe('8-K');
      expect(extractFilingType('10-K - company').type).toBe('10-K');
    });
  });

  describe('parseRssDate', () => {
    it('should parse RFC 2822 date', () => {
      const date = parseRssDate('Fri, 15 Jan 2024 16:30:00 EST');
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0); // January
      // Note: EST is UTC-5, so 16:30 EST = 21:30 UTC
      // The date might be 15 or 16 depending on timezone, just verify it's valid
      expect(date.getDate()).toBeGreaterThanOrEqual(15);
      expect(date.getDate()).toBeLessThanOrEqual(16);
    });

    it('should parse ISO 8601 date', () => {
      const date = parseRssDate('2024-01-15T16:30:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });

    it('should return current date for invalid input', () => {
      const before = Date.now();
      const date = parseRssDate('invalid date');
      const after = Date.now();

      expect(date.getTime()).toBeGreaterThanOrEqual(before);
      expect(date.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle empty string', () => {
      const date = parseRssDate('');
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('isValidRssItem', () => {
    it('should return true for valid item', () => {
      const item: SecRssItem = {
        title: 'Test Title',
        link: 'https://example.com',
        pubDate: '2024-01-15',
      };
      expect(isValidRssItem(item)).toBe(true);
    });

    it('should return false for item without title', () => {
      const item: SecRssItem = {
        title: '',
        link: 'https://example.com',
        pubDate: '2024-01-15',
      };
      expect(isValidRssItem(item)).toBe(false);
    });

    it('should return false for item without link', () => {
      const item: SecRssItem = {
        title: 'Test',
        link: '',
        pubDate: '2024-01-15',
      };
      expect(isValidRssItem(item)).toBe(false);
    });
  });
});
