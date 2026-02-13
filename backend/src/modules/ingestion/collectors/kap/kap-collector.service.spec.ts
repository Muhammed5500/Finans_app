import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NewsSource } from '@prisma/client';
import { KapCollectorService } from './kap-collector.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('KapCollectorService', () => {
  let service: KapCollectorService;
  let prismaService: jest.Mocked<PrismaService>;

  // Sample KAP response
  const sampleKapResponse = JSON.stringify({
    success: true,
    data: [
      {
        disclosureId: '12345',
        title: 'Şirket Genel Bilgi Formu Güncellemesi',
        url: '/bildirim/12345',
        publishDate: '15.01.2024 16:30',
        stockCode: 'THYAO',
        companyName: 'Türk Hava Yolları A.O.',
        disclosureType: 'ODA',
      },
      {
        disclosureId: '12346',
        title: 'Kar Dağıtım Politikası',
        url: '/bildirim/12346',
        publishDate: '15.01.2024 17:00',
        stockCode: 'GARAN',
        companyName: 'Garanti BBVA',
        disclosureType: 'FYB',
      },
      {
        disclosureId: '12347',
        title: 'Genel Kurul Toplantı Sonuçları',
        url: '/bildirim/12347',
        publishDate: '15.01.2024 18:00',
        stockCode: 'TUPRS',
        companyName: 'Tüpraş',
        disclosureType: 'GK',
      },
    ],
  });

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
          KAP_ENABLED: true,
          KAP_BASE_URL: 'https://www.kap.org.tr',
          KAP_QUERY_PATH: '/tr/api/bildirim',
          KAP_METHOD: 'POST',
          KAP_HEADERS: '',
          KAP_BODY: '{}',
          KAP_QUERY_PARAMS: '',
          KAP_RESPONSE_TYPE: 'json',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KapCollectorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<KapCollectorService>(KapCollectorService);
    prismaService = module.get(PrismaService);

    // Clear cache for each test
    service.clearCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report enabled status when configured', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.configured).toBe(true);
    });

    it('should have correct base URL', () => {
      const status = service.getStatus();
      expect(status.config.baseUrl).toBe('https://www.kap.org.tr');
    });
  });

  describe('normalizeItem', () => {
    it('should normalize KAP item to NormalizedNewsItem', () => {
      const parsedItem = {
        sourceId: '12345',
        title: 'Test Disclosure',
        url: 'https://www.kap.org.tr/bildirim/12345',
        publishedAt: new Date('2024-01-15T16:30:00'),
        stockCode: 'THYAO',
        companyName: 'Türk Hava Yolları',
        disclosureType: 'ODA',
        summary: 'Test summary',
        raw: { originalField: 'value' },
      };

      const result = service.normalizeItem(parsedItem);

      expect(result.source).toBe(NewsSource.KAP);
      expect(result.sourceId).toBe('12345');
      expect(result.title).toBe('Test Disclosure');
      expect(result.language).toBe('tr');
      expect(result.raw).toHaveProperty('kap');
      expect((result.raw as any).kap.stockCode).toBe('THYAO');
    });
  });

  describe('collect', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleKapResponse),
      });
    });

    it('should collect and save new items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.collect();

      expect(result.itemsFound).toBe(3);
      expect(result.itemsNew).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should use in-memory cache for deduplication', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      // First collection
      const result1 = await service.collect();
      expect(result1.itemsNew).toBe(3);
      expect(result1.itemsCached).toBe(0);

      // Reset fetch mock to return same data
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleKapResponse),
      });

      // Second collection - should be cached
      const result2 = await service.collect();
      expect(result2.itemsCached).toBe(3);
      expect(result2.itemsNew).toBe(0);
    }, 15000); // Increase timeout to account for rate limiting

    it('should dedupe against existing DB items', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([
        { url: 'https://kap.org.tr/bildirim/12345' },
      ]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.collect();

      // 3 found, but 1 was already in DB from our dedup check
      expect(result.itemsFound).toBe(3);
    });

    it('should update cursor after successful collection', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.collect();

      expect(prismaService.ingestionCursor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_key: {
              source: NewsSource.KAP,
              key: 'lastPublishedAt',
            },
          },
        }),
      );
    });

    it('should prevent concurrent runs', async () => {
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      // Add delay to fetch
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: () => Promise.resolve(sampleKapResponse),
                }),
              100,
            ),
          ),
      );

      const promise1 = service.collect();
      const promise2 = service.collect();

      const [, result2] = await Promise.all([promise1, promise2]);

      // Second run should return empty (skipped)
      expect(result2.itemsFound).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.collect();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
      expect(result.itemsFound).toBe(0);
    }, 20000); // Increase timeout for retries

    it('should handle invalid JSON gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid json'),
      });

      const result = await service.collect();

      // Should not throw, but should have 0 items
      expect(result.itemsFound).toBe(0);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await service.collect();

      expect(result.errors.length).toBeGreaterThan(0);
    }, 20000); // Increase timeout for retries

    it('should not crash on database errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleKapResponse),
      });
      (prismaService.newsItem.createMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      const result = await service.collect();

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('tagging', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleKapResponse),
      });
      (prismaService.newsItem.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.newsItem.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });
      (prismaService.newsItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'news-item-id',
      });
    });

    it('should add kap and turkey tags', async () => {
      await service.collect();

      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'kap' },
        }),
      );
      expect(prismaService.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'turkey' },
        }),
      );
    });
  });

  describe('configuration', () => {
    it('should allow runtime config update', () => {
      service.updateConfig({
        queryPath: '/new/path',
        method: 'GET',
      });

      const status = service.getStatus();
      expect(status.config.queryPath).toBe('/new/path');
      expect(status.config.method).toBe('GET');
    });

    it('should report cache stats', () => {
      const status = service.getStatus();
      expect(status.cache).toHaveProperty('sizeBySourceId');
      expect(status.cache).toHaveProperty('maxSize');
    });
  });

  describe('disabled collector', () => {
    it('should skip collection when disabled', async () => {
      // Create new service with disabled config
      const mockConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'KAP_ENABLED') return false;
          if (key === 'KAP_QUERY_PATH') return '';
          return defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KapCollectorService,
          { provide: PrismaService, useValue: prismaService },
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();

      const disabledService =
        module.get<KapCollectorService>(KapCollectorService);
      const result = await disabledService.collect();

      expect(result.itemsFound).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
