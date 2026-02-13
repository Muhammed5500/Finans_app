import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsSource } from '@prisma/client';
import { GdeltCollectorService } from './gdelt-collector.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { GdeltArticle, GdeltResponse } from './gdelt.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GdeltCollectorService', () => {
  let service: GdeltCollectorService;
  let prismaService: jest.Mocked<PrismaService>;

  // Sample GDELT articles
  const sampleArticles: GdeltArticle[] = [
    {
      url: 'https://example.com/article1',
      title: 'Tesla stock rises on strong earnings',
      seendate: '20240115T163000Z',
      domain: 'example.com',
      language: 'English',
      sourcecountry: 'United States',
    },
    {
      url: 'https://example.com/article2',
      title: 'Fed signals rate pause amid cooling inflation',
      seendate: '20240115T170000Z',
      domain: 'example.com',
      language: 'English',
      sourcecountry: 'United States',
    },
    {
      url: 'https://example.com/article3',
      title: 'Bitcoin breaks $50K as crypto rally continues',
      seendate: '20240115T180000Z',
      domain: 'example.com',
      language: 'English',
      sourcecountry: 'United States',
    },
  ];

  const mockGdeltResponse: GdeltResponse = {
    articles: sampleArticles,
  };

  beforeEach(async () => {
    // Reset mocks
    mockFetch.mockReset();

    // Create mock PrismaService
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

    // Create mock ConfigService
    const mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          GDELT_ENABLED: true,
          GDELT_QUERIES: 'Tesla,Fed,BTC',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdeltCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<GdeltCollectorService>(GdeltCollectorService);
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
      expect(status.queries).toEqual(['Tesla', 'Fed', 'BTC']);
    });

    it('should report enabled status', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
    });
  });

  describe('normalizeArticle', () => {
    it('should normalize GDELT article to NormalizedNewsItem', () => {
      const article = sampleArticles[0];
      const result = service.normalizeArticle(article, 'Tesla');

      expect(result.source).toBe(NewsSource.GDELT);
      expect(result.title).toBe(article.title);
      expect(result.url).toContain('example.com');
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.raw).toHaveProperty('gdelt');
      expect((result.raw as any).gdelt.query).toBe('Tesla');
    });

    it('should parse GDELT date format correctly', () => {
      const article = { ...sampleArticles[0], seendate: '20240115T163000Z' };
      const result = service.normalizeArticle(article, 'test');

      expect(result.publishedAt.toISOString()).toBe('2024-01-15T16:30:00.000Z');
    });

    it('should canonicalize URL', () => {
      const article = {
        ...sampleArticles[0],
        url: 'https://www.example.com/article?utm_source=test',
      };
      const result = service.normalizeArticle(article, 'test');

      expect(result.url).toBe('https://example.com/article');
    });
  });

  describe('fetchWithRetry', () => {
    it('should fetch successfully on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGdeltResponse),
      });

      const result = await service.fetchWithRetry('https://api.gdelt.org/test');

      expect(result.articles).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure with exponential backoff', async () => {
      // Fail twice, succeed on third attempt
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGdeltResponse),
        });

      const result = await service.fetchWithRetry('https://api.gdelt.org/test');

      expect(result.articles).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should throw after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        service.fetchWithRetry('https://api.gdelt.org/test'),
      ).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        service.fetchWithRetry('https://api.gdelt.org/test'),
      ).rejects.toThrow('HTTP 500');
    }, 10000);

    it('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(
        service.fetchWithRetry('https://api.gdelt.org/test'),
      ).rejects.toThrow('HTTP 400');

      // Should not retry
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('collectQuery', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGdeltResponse),
      });
    });

    it('should collect and save new items', async () => {
      // Mock empty existing items
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.collectQuery('Tesla');

      expect(result.query).toBe('Tesla');
      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should dedupe existing items', async () => {
      // Mock one existing item
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([
        { url: 'https://example.com/article1' },
      ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.collectQuery('Tesla');

      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(2);
    });

    it('should update cursor after successful collection', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.collectQuery('Tesla');

      expect(prismaService.ingestionCursor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_key: {
              source: NewsSource.GDELT,
              key: 'query:Tesla',
            },
          },
        }),
      );
    });

    it('should use cursor for incremental fetching', async () => {
      // Mock existing cursor
      (prismaService.ingestionCursor.findUnique as jest.Mock).mockResolvedValue(
        {
          value: '2024-01-15T16:00:00.000Z',
        },
      );

      await service.collectQuery('Tesla');

      // Verify fetch was called with startdatetime parameter
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startdatetime='),
        expect.any(Object),
      );
    });
  });

  describe('collect (full run)', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGdeltResponse),
      });
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
    });

    it('should collect from all configured queries', async () => {
      const results = await service.collect();

      expect(results).toHaveLength(3); // Tesla, Fed, BTC
      expect(results[0].query).toBe('Tesla');
      expect(results[1].query).toBe('Fed');
      expect(results[2].query).toBe('BTC');
    });

    it('should continue on query failure', async () => {
      // Fail on second query with non-retryable 400 error
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGdeltResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGdeltResponse),
        });

      const results = await service.collect();

      expect(results).toHaveLength(3);
      expect(results[0].errors).toHaveLength(0);
      expect(results[1].errors).toHaveLength(1);
      expect(results[1].errors[0]).toContain('HTTP 400');
      expect(results[2].errors).toHaveLength(0);
    }, 10000);

    it('should prevent concurrent runs', async () => {
      // Start first collection
      const promise1 = service.collect();

      // Try to start second collection immediately
      const promise2 = service.collect();

      const [, results2] = await Promise.all([promise1, promise2]);

      // Second run should return empty (skipped)
      expect(results2).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: [] }),
      });

      const result = await service.collectQuery('Tesla');

      expect(result.itemsFound).toBe(0);
      expect(result.itemsNew).toBe(0);
    });

    it('should handle missing articles field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await service.collectQuery('Tesla');

      expect(result.itemsFound).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGdeltResponse),
      });
      (prismaService.newsItem.createMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.collectQuery('Tesla')).rejects.toThrow(
        'Database error',
      );
    });
  });
});

describe('TokenBucket', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TokenBucket } = require('./token-bucket');

  it('should allow immediate consumption when tokens available', () => {
    const bucket = new TokenBucket(5, 1);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
  });

  it('should deny consumption when no tokens', () => {
    const bucket = new TokenBucket(1, 1);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it('should refill tokens over time', async () => {
    const bucket = new TokenBucket(1, 10); // 10 tokens per second
    bucket.tryConsume(); // Use the token

    // Wait 200ms (should add ~2 tokens)
    await new Promise((r) => setTimeout(r, 200));

    expect(bucket.tryConsume()).toBe(true);
  });

  it('should calculate wait time correctly', () => {
    const bucket = new TokenBucket(1, 1); // 1 token per second
    bucket.tryConsume();

    const waitTime = bucket.getWaitTime();
    expect(waitTime).toBeGreaterThan(0);
    expect(waitTime).toBeLessThanOrEqual(1000);
  });

  it('should respect max tokens', async () => {
    const bucket = new TokenBucket(2, 100); // High refill rate

    // Wait for refill
    await new Promise((r) => setTimeout(r, 100));

    // Should still only have max tokens
    expect(bucket.getTokens()).toBeLessThanOrEqual(2);
  });
});
