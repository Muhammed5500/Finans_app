import { Test, TestingModule } from '@nestjs/testing';
import { NewsSource } from '@prisma/client';
import { NewsIngestService } from './news-ingest.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TaggingService } from '../../../shared/tagging';
import { NormalizedNewsItem } from '../../../shared/types';

describe('NewsIngestService', () => {
  let service: NewsIngestService;
  let prismaService: jest.Mocked<PrismaService>;
  let taggingService: jest.Mocked<TaggingService>;

  // Sample news items
  const createSampleItem = (
    overrides: Partial<NormalizedNewsItem> = {},
  ): NormalizedNewsItem => ({
    source: NewsSource.GDELT,
    sourceId: 'test-source-id',
    title: 'Tesla stock rises on strong earnings',
    url: 'https://example.com/article1',
    publishedAt: new Date('2024-01-15T16:30:00Z'),
    language: 'en',
    raw: { test: 'data' },
    discoveredAt: new Date(),
    ...overrides,
  });

  const sampleItems: NormalizedNewsItem[] = [
    createSampleItem({
      title: 'Tesla stock rises on strong earnings',
      url: 'https://example.com/article1',
      sourceId: 'id1',
    }),
    createSampleItem({
      title: 'Fed announces rate decision',
      url: 'https://example.com/article2',
      sourceId: 'id2',
    }),
    createSampleItem({
      title: 'Bitcoin breaks $50K',
      url: 'https://example.com/article3',
      sourceId: 'id3',
    }),
  ];

  beforeEach(async () => {
    // Create mock transaction
    const mockTransaction = jest.fn((callback) => callback(prismaService));

    const mockPrisma = {
      $transaction: mockTransaction,
      newsItem: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      ticker: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tag: {
        upsert: jest
          .fn()
          .mockImplementation(({ create }) =>
            Promise.resolve({ id: `tag-${create.name}`, name: create.name }),
          ),
      },
      newsItemTicker: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      newsItemTag: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const mockTagging = {
      extractAll: jest.fn().mockReturnValue({ tickers: [], tags: [] }),
      extractTickers: jest.fn().mockReturnValue([]),
      extractTags: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsIngestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TaggingService, useValue: mockTagging },
      ],
    }).compile();

    service = module.get<NewsIngestService>(NewsIngestService);
    prismaService = module.get(PrismaService);
    taggingService = module.get(TaggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ingest', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return zero stats for empty array', async () => {
      const stats = await service.ingest([]);

      expect(stats.inserted).toBe(0);
      expect(stats.updated).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should insert new items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const stats = await service.ingest(sampleItems);

      expect(stats.inserted).toBe(3);
      expect(stats.updated).toBe(0);
      expect(stats.skipped).toBe(0);
    });

    it('should update existing items', async () => {
      // Mock existing items
      (prismaService.newsItem.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'existing-1', url: 'https://example.com/article1' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'existing-1',
            url: 'https://example.com/article1',
            title: 'Old title',
          },
        ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const stats = await service.ingest(sampleItems);

      expect(stats.updated).toBe(1);
      expect(stats.inserted).toBe(2);
    });

    it('should skip items with invalid URLs', async () => {
      const itemsWithInvalid = [
        ...sampleItems,
        createSampleItem({ url: '' }), // Empty URL
      ];

      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const stats = await service.ingest(itemsWithInvalid);

      expect(stats.skipped).toBe(1);
    });

    it('should skip duplicate URLs in same batch', async () => {
      const itemsWithDupe = [
        createSampleItem({
          url: 'https://example.com/same-url',
          sourceId: '1',
        }),
        createSampleItem({
          url: 'https://example.com/same-url',
          sourceId: '2',
        }),
      ];

      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const stats = await service.ingest(itemsWithDupe);

      expect(stats.skipped).toBe(1);
      expect(stats.inserted).toBe(1);
    });

    it('should skip items missing required fields', async () => {
      const invalidItems = [
        createSampleItem({ title: '' }), // Empty title
        createSampleItem({ source: undefined as any }), // Missing source
      ];

      const stats = await service.ingest(invalidItems);

      expect(stats.skipped).toBe(2);
      expect(stats.inserted).toBe(0);
    });

    it('should canonicalize URLs', async () => {
      const itemsWithTrackingParams = [
        createSampleItem({
          url: 'https://WWW.example.com/article?utm_source=test&utm_medium=email',
        }),
      ];

      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.ingest(itemsWithTrackingParams);

      // Verify createMany was called with canonicalized URL
      expect(prismaService.newsItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://example.com/article',
            }),
          ]),
        }),
      );
    });
  });

  describe('ticker and tag attachment', () => {
    beforeEach(() => {
      (prismaService.newsItem.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // First call for existing items
        .mockResolvedValueOnce([
          // Second call for getting IDs
          { id: 'news-1', url: 'https://example.com/article1', title: 'Tesla' },
        ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
    });

    it('should attach extracted tickers', async () => {
      // Mock ticker extraction
      (taggingService.extractAll as jest.Mock).mockReturnValue({
        tickers: ['TSLA'],
        tags: [],
      });

      // Mock existing ticker
      (prismaService.ticker.findMany as jest.Mock).mockResolvedValue([
        { id: 'ticker-tsla', symbol: 'TSLA' },
      ]);

      const stats = await service.ingest([sampleItems[0]]);

      expect(prismaService.newsItemTicker.upsert).toHaveBeenCalled();
      expect(stats.tickersAttached).toBeGreaterThan(0);
    });

    it('should attach extracted tags', async () => {
      // Mock tag extraction
      (taggingService.extractAll as jest.Mock).mockReturnValue({
        tickers: [],
        tags: ['earnings', 'tech'],
      });

      const stats = await service.ingest([sampleItems[0]]);

      expect(prismaService.tag.upsert).toHaveBeenCalled();
      expect(prismaService.newsItemTag.upsert).toHaveBeenCalled();
      expect(stats.tagsAttached).toBeGreaterThan(0);
    });

    it('should create missing tags via upsert', async () => {
      (taggingService.extractAll as jest.Mock).mockReturnValue({
        tickers: [],
        tags: ['new-tag'],
      });

      await service.ingest([sampleItems[0]]);

      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'new-tag' },
          create: { name: 'new-tag' },
          update: {},
        }),
      );
    });

    it('should not attach tickers that do not exist in DB', async () => {
      (taggingService.extractAll as jest.Mock).mockReturnValue({
        tickers: ['UNKNOWN'],
        tags: [],
      });

      // Mock no tickers found
      (prismaService.ticker.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await service.ingest([sampleItems[0]]);

      expect(prismaService.newsItemTicker.upsert).not.toHaveBeenCalled();
      expect(stats.tickersAttached).toBe(0);
    });
  });

  describe('batching', () => {
    it('should process items in batches', async () => {
      // Create 120 items (should be 3 batches with default size 50)
      const manyItems = Array.from({ length: 120 }, (_, i) =>
        createSampleItem({
          url: `https://example.com/article${i}`,
          sourceId: `id-${i}`,
        }),
      );

      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      await service.ingest(manyItems, { batchSize: 50 });

      // Should be called 3 times for each batch
      expect(prismaService.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should continue processing on batch failure', async () => {
      const items = Array.from({ length: 100 }, (_, i) =>
        createSampleItem({
          url: `https://example.com/article${i}`,
          sourceId: `id-${i}`,
        }),
      );

      // First batch fails, second succeeds
      (prismaService.$transaction as jest.Mock)
        .mockRejectedValueOnce(new Error('Batch 1 failed'))
        .mockImplementation((callback) => callback(prismaService));

      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      const stats = await service.ingest(items, { batchSize: 50 });

      expect(stats.errors.length).toBe(1);
      expect(stats.errors[0]).toContain('Batch 1');
    });
  });

  describe('idempotency', () => {
    it('should not create duplicates on re-ingestion', async () => {
      // First ingestion
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const stats1 = await service.ingest(sampleItems);
      expect(stats1.inserted).toBe(3);

      // Second ingestion - all items now exist
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([
        { id: '1', url: 'https://example.com/article1' },
        { id: '2', url: 'https://example.com/article2' },
        { id: '3', url: 'https://example.com/article3' },
      ]);

      const stats2 = await service.ingest(sampleItems);

      expect(stats2.inserted).toBe(0);
      expect(stats2.updated).toBe(3);
    });

    it('should use skipDuplicates flag', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.ingest(sampleItems);

      expect(prismaService.newsItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });
  });

  describe('ingestOne', () => {
    it('should ingest a single item', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const stats = await service.ingestOne(sampleItems[0]);

      expect(stats.inserted).toBe(1);
    });
  });

  describe('bulkUpsertByUrl', () => {
    it('should return map of URL to ID', async () => {
      (prismaService.newsItem.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'existing-1', url: 'https://example.com/article1' },
        ])
        .mockResolvedValueOnce([
          { id: 'new-2', url: 'https://example.com/article2' },
          { id: 'new-3', url: 'https://example.com/article3' },
        ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const urlToId = await service.bulkUpsertByUrl(sampleItems);

      expect(urlToId.size).toBe(3);
      expect(urlToId.get('https://example.com/article1')).toBe('existing-1');
    });

    it('should handle empty array', async () => {
      const urlToId = await service.bulkUpsertByUrl([]);
      expect(urlToId.size).toBe(0);
    });

    it('should dedupe by canonical URL', async () => {
      const items = [
        createSampleItem({ url: 'https://example.com/same' }),
        createSampleItem({ url: 'https://example.com/same?utm_source=test' }),
      ];

      (prismaService.newsItem.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'new-1', url: 'https://example.com/same' },
        ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const urlToId = await service.bulkUpsertByUrl(items);

      // Should only have one entry (deduplicated)
      expect(urlToId.size).toBe(1);
    });
  });

  describe('getIngestionStats', () => {
    it('should return aggregated statistics', async () => {
      (prismaService.newsItem.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { source: 'GDELT', _count: 100 },
          { source: 'SEC_RSS', _count: 50 },
        ])
        .mockResolvedValueOnce([
          { language: 'en', _count: 120 },
          { language: 'tr', _count: 30 },
        ]);

      const stats = await service.getIngestionStats(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(stats.totalItems).toBe(150);
      expect(stats.bySource.GDELT).toBe(100);
      expect(stats.bySource.SEC_RSS).toBe(50);
      expect(stats.byLanguage.en).toBe(120);
      expect(stats.byLanguage.tr).toBe(30);
    });
  });

  describe('performance', () => {
    it('should track processing time', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const stats = await service.ingest(sampleItems);

      expect(stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
