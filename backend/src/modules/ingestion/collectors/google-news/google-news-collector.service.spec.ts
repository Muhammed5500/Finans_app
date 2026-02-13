import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsSource } from '@prisma/client';
import { GoogleNewsRssCollectorService } from './google-news-collector.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoogleNewsRssCollectorService', () => {
  let service: GoogleNewsRssCollectorService;
  let prismaService: jest.Mocked<PrismaService>;

  // Sample Google News RSS response
  const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"BIST" - Google News</title>
    <link>https://news.google.com</link>
    <item>
      <title>BIST 100 rallies on positive economic data - Reuters</title>
      <link>https://news.google.com/rss/articles/article1</link>
      <guid>article1</guid>
      <pubDate>Mon, 15 Jan 2024 16:30:00 GMT</pubDate>
      <description><![CDATA[<a href="https://reuters.com">Reuters</a>]]></description>
      <source>Reuters</source>
    </item>
    <item>
      <title>Turkish stocks gain amid rate expectations - Bloomberg</title>
      <link>https://news.google.com/rss/articles/article2</link>
      <guid>article2</guid>
      <pubDate>Mon, 15 Jan 2024 14:00:00 GMT</pubDate>
      <description><![CDATA[<a href="https://bloomberg.com">Bloomberg</a>]]></description>
      <source>Bloomberg</source>
    </item>
    <item>
      <title>Market update: BIST gains 2% - Financial Times</title>
      <link>https://news.google.com/rss/articles/article3</link>
      <guid>article3</guid>
      <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
      <source>Financial Times</source>
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
          ENABLE_GOOGLE_NEWS_RSS: 'true',
          GOOGLE_NEWS_QUERIES: 'BIST,BTC,TUPRS',
          GOOGLE_NEWS_HL: 'en-US',
          GOOGLE_NEWS_GL: 'US',
          GOOGLE_NEWS_CEID: 'US:en',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleNewsRssCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<GoogleNewsRssCollectorService>(
      GoogleNewsRssCollectorService,
    );
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load queries from config', () => {
      const status = service.getStatus();
      expect(status.queries).toEqual(['BIST', 'BTC', 'TUPRS']);
    });

    it('should report enabled status', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
    });

    it('should have correct language config', () => {
      const status = service.getStatus();
      expect(status.config.hl).toBe('en-US');
      expect(status.config.gl).toBe('US');
    });
  });

  describe('disabled collector', () => {
    it('should skip collection when disabled', async () => {
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'ENABLE_GOOGLE_NEWS_RSS') return 'false';
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GoogleNewsRssCollectorService,
          { provide: PrismaService, useValue: prismaService },
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();

      const disabledService = module.get<GoogleNewsRssCollectorService>(
        GoogleNewsRssCollectorService,
      );

      expect(disabledService.isEnabled()).toBe(false);

      const results = await disabledService.collect();
      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('normalizeRssItem', () => {
    it('should normalize RSS item to NormalizedNewsItem', () => {
      const rssItem = {
        title: 'BIST 100 rallies - Reuters',
        link: 'https://news.google.com/rss/articles/article1',
        pubDate: 'Mon, 15 Jan 2024 16:30:00 GMT',
        description: '<a href="https://reuters.com">Reuters</a>',
        source: 'Reuters',
        guid: 'article1',
      };

      const result = service.normalizeRssItem(rssItem, 'BIST');

      expect(result.source).toBe(NewsSource.GOOGLE_NEWS);
      expect(result.title).toContain('BIST 100');
      expect(result.url).toContain('news.google.com');
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.raw).toHaveProperty('googleNews');
      expect((result.raw as any).googleNews.sourceName).toBe('Reuters');
      expect((result.raw as any).googleNews.query).toBe('BIST');
    });

    it('should detect language from URL', () => {
      const rssItem = {
        title: 'Test',
        link: 'https://news.google.com/rss?hl=tr',
        pubDate: 'Mon, 15 Jan 2024 16:30:00 GMT',
      };

      const result = service.normalizeRssItem(rssItem, 'test');
      expect(result.language).toBe('tr');
    });

    it('should canonicalize URL', () => {
      const rssItem = {
        title: 'Test',
        link: 'https://WWW.news.google.com/rss/articles/test?utm_source=test',
        pubDate: 'Mon, 15 Jan 2024 16:30:00 GMT',
      };

      const result = service.normalizeRssItem(rssItem, 'test');
      expect(result.url).not.toContain('utm_source');
      expect(result.url).not.toContain('WWW');
    });
  });

  describe('collectQuery', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleRss),
      });
    });

    it('should collect and save new items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.collectQuery('BIST');

      expect(result.query).toBe('BIST');
      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should dedupe existing items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([
        { url: 'https://news.google.com/rss/articles/article1' },
      ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.collectQuery('BIST');

      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(2);
    });

    it('should update cursor after successful collection', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.collectQuery('BIST');

      expect(prismaService.ingestionCursor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_key: {
              source: NewsSource.GOOGLE_NEWS,
              key: 'query:BIST',
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
        text: () => Promise.resolve(sampleRss),
      });
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
    });

    it('should collect from all configured queries', async () => {
      const results = await service.collect();

      expect(results).toHaveLength(3); // BIST, BTC, TUPRS
      expect(results[0].query).toBe('BIST');
      expect(results[1].query).toBe('BTC');
      expect(results[2].query).toBe('TUPRS');
    }, 15000);

    it('should continue on query failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(sampleRss),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(sampleRss),
        });

      const results = await service.collect();

      expect(results).toHaveLength(3);
      expect(results[0].errors).toHaveLength(0);
      expect(results[1].errors).toHaveLength(1);
      expect(results[2].errors).toHaveLength(0);
    }, 15000);

    it('should prevent concurrent runs', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: () => Promise.resolve(sampleRss),
                }),
              100,
            ),
          ),
      );

      const promise1 = service.collect();
      const promise2 = service.collect();

      const [, results2] = await Promise.all([promise1, promise2]);

      expect(results2).toHaveLength(0);
    }, 15000);
  });

  describe('error handling', () => {
    it('should handle empty feed', async () => {
      const emptyRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(emptyRss),
      });

      const result = await service.collectQuery('BIST');

      expect(result.itemsFound).toBe(0);
      expect(result.itemsNew).toBe(0);
    });

    it('should handle invalid XML gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid xml'),
      });

      // Parser handles invalid XML gracefully, returns empty result
      const result = await service.collectQuery('BIST');
      expect(result.itemsFound).toBe(0);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(service.collectQuery('BIST')).rejects.toThrow('HTTP 500');
    }, 15000);
  });
});
