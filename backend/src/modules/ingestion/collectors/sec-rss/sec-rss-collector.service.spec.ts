import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsSource } from '@prisma/client';
import { SecRssCollectorService } from './sec-rss-collector.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { SecRssItem } from './sec-rss.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SecRssCollectorService', () => {
  let service: SecRssCollectorService;
  let prismaService: jest.Mocked<PrismaService>;

  // Sample RSS response
  const sampleRssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SEC EDGAR Filings</title>
    <item>
      <title>8-K - TESLA INC (0001318605)</title>
      <link>https://www.sec.gov/Archives/edgar/data/1318605/tsla-8k.htm</link>
      <description>Current report</description>
      <pubDate>Fri, 15 Jan 2024 16:30:00 EST</pubDate>
      <guid>edgar-1318605-8k</guid>
    </item>
    <item>
      <title>10-K - APPLE INC (0000320193)</title>
      <link>https://www.sec.gov/Archives/edgar/data/320193/aapl-10k.htm</link>
      <description>Annual report</description>
      <pubDate>Thu, 14 Jan 2024 09:00:00 EST</pubDate>
      <guid>edgar-320193-10k</guid>
    </item>
    <item>
      <title>4 - MUSK ELON</title>
      <link>https://www.sec.gov/Archives/edgar/data/1494730/form4.htm</link>
      <description>Statement of changes</description>
      <pubDate>Wed, 13 Jan 2024 18:00:00 EST</pubDate>
      <guid>edgar-1494730-4</guid>
    </item>
  </channel>
</rss>`;

  beforeEach(async () => {
    mockFetch.mockReset();

    const mockPrisma = {
      newsItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      ticker: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      tag: {
        upsert: jest.fn().mockResolvedValue({ id: 'tag-id', name: 'test' }),
      },
      newsItemTicker: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      newsItemTag: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      ingestionCursor: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          SEC_RSS_ENABLED: true,
          SEC_RSS_FEEDS: '',
          APP_UA: 'TestApp/1.0 (test@example.com)',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecRssCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SecRssCollectorService>(SecRssCollectorService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load default feeds when SEC_RSS_FEEDS is empty', () => {
      const status = service.getStatus();
      expect(status.feeds.length).toBeGreaterThan(0);
      expect(status.feeds[0]).toContain('sec.gov');
    });

    it('should report enabled status', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
    });

    it('should have configured User-Agent', () => {
      const status = service.getStatus();
      expect(status.userAgent).toBe('TestApp/1.0 (test@example.com)');
    });
  });

  describe('normalizeRssItem', () => {
    it('should normalize RSS item to NormalizedNewsItem', () => {
      const rssItem: SecRssItem = {
        title: '8-K - TESLA INC (0001318605)',
        link: 'https://www.sec.gov/Archives/edgar/data/1318605/tsla-8k.htm',
        description: 'Current report',
        pubDate: 'Fri, 15 Jan 2024 16:30:00 EST',
        guid: 'edgar-1318605-8k',
      };

      const result = service.normalizeRssItem(rssItem, 'https://sec.gov/feed');

      expect(result.source).toBe(NewsSource.SEC_RSS);
      expect(result.title).toBe('8-K - TESLA INC (0001318605)');
      expect(result.url).toContain('sec.gov');
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.language).toBe('en');
      expect(result.raw).toHaveProperty('sec');
      expect((result.raw as any).sec.filingType).toBe('8-K');
      expect((result.raw as any).sec.companyName).toBe('TESLA INC');
    });

    it('should extract filing type from title', () => {
      const rssItem: SecRssItem = {
        title: '10-Q - MICROSOFT CORP',
        link: 'https://example.com',
        pubDate: 'Fri, 15 Jan 2024 16:30:00 EST',
      };

      const result = service.normalizeRssItem(rssItem, 'https://sec.gov/feed');
      expect((result.raw as any).sec.filingType).toBe('10-Q');
    });

    it('should canonicalize URL', () => {
      const rssItem: SecRssItem = {
        title: 'Test',
        link: 'https://WWW.sec.gov/path?utm_source=test',
        pubDate: 'Fri, 15 Jan 2024 16:30:00 EST',
      };

      const result = service.normalizeRssItem(rssItem, 'https://sec.gov/feed');
      expect(result.url).toBe('https://sec.gov/path');
    });
  });

  describe('fetchWithRetry', () => {
    it('should fetch successfully on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });

      const result = await service.fetchWithRetry('https://sec.gov/feed');

      expect(result).toContain('TESLA INC');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });

      await service.fetchWithRetry('https://sec.gov/feed');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'TestApp/1.0 (test@example.com)',
            Accept: expect.stringContaining('application/atom+xml'),
          }),
        }),
      );
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(sampleRssFeed),
        });

      const result = await service.fetchWithRetry('https://sec.gov/feed');

      expect(result).toContain('TESLA INC');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should throw after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.fetchWithRetry('https://sec.gov/feed'),
      ).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        service.fetchWithRetry('https://sec.gov/feed'),
      ).rejects.toThrow('HTTP 404');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('collectFeed', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });
    });

    it('should collect and save new items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.collectFeed('https://sec.gov/feed');

      expect(result.feedUrl).toBe('https://sec.gov/feed');
      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should dedupe existing items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([
        { url: 'https://sec.gov/Archives/edgar/data/1318605/tsla-8k.htm' },
      ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.collectFeed('https://sec.gov/feed');

      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(2);
    });

    it('should update cursor after successful collection', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.collectFeed('https://sec.gov/feed');

      expect(prismaService.ingestionCursor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_key: {
              source: NewsSource.SEC_RSS,
              key: expect.any(String),
            },
          },
        }),
      );
    });
  });

  describe('collect (full run)', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
    });

    it('should collect from all configured feeds', async () => {
      const results = await service.collect();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].itemsFound).toBe(3);
    });

    it('should continue on feed failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(sampleRssFeed),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      const results = await service.collect();

      // Should have results from both feeds (success + error)
      expect(results.length).toBeGreaterThanOrEqual(1);
      // At least one should have items
      const successfulFeeds = results.filter((r) => r.itemsFound > 0);
      expect(successfulFeeds.length).toBeGreaterThanOrEqual(1);
    });

    it('should prevent concurrent runs', async () => {
      const promise1 = service.collect();
      const promise2 = service.collect();

      const [, results2] = await Promise.all([promise1, promise2]);

      // Second run should return empty (skipped)
      expect(results2).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle empty feed', async () => {
      const emptyFeed = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(emptyFeed),
      });

      const result = await service.collectFeed('https://sec.gov/feed');

      expect(result.itemsFound).toBe(0);
      expect(result.itemsNew).toBe(0);
    });

    it('should handle malformed XML gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid xml'),
      });

      // Should not throw - returns empty result or logs error
      const result = await service.collectFeed('https://sec.gov/feed');
      expect(result.itemsFound).toBe(0);
    });

    it('should handle database errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });
      (prismaService.newsItem.createMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.collectFeed('https://sec.gov/feed')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('filing type tagging', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRssFeed),
      });
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
      (prismaService.newsItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'news-item-id',
      });
    });

    it('should add sec-filing tag for SEC filings', async () => {
      await service.collectFeed('https://sec.gov/feed');

      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'sec-filing' },
        }),
      );
    });

    it('should add earnings tag for 8-K/10-K/10-Q filings', async () => {
      await service.collectFeed('https://sec.gov/feed');

      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'earnings' },
        }),
      );
    });

    it('should add insider tag for Form 4 filings', async () => {
      await service.collectFeed('https://sec.gov/feed');

      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'insider' },
        }),
      );
    });
  });
});
