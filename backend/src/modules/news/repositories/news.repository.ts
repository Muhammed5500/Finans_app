import { Injectable, Logger } from '@nestjs/common';
import { NewsSource, Market, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * News query filters
 */
export interface NewsQueryFilters {
  source?: NewsSource;
  sources?: NewsSource[];
  market?: Market;
  tickerSymbols?: string[];
  tagNames?: string[];
  language?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

/**
 * NewsRepository
 *
 * Data access layer for news items.
 *
 * Responsibilities:
 * - CRUD operations for news_items
 * - Query building with filters
 * - Pagination helpers
 */
@Injectable()
export class NewsRepository {
  private readonly logger = new Logger(NewsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find news item by ID
   */
  async findById(id: string) {
    return this.prisma.newsItem.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        tickers: { include: { ticker: true } },
      },
    });
  }

  /**
   * Find news item by URL (for dedup)
   */
  async findByUrl(url: string) {
    return this.prisma.newsItem.findUnique({
      where: { url },
    });
  }

  /**
   * Check if URL exists (for dedup)
   */
  async urlExists(url: string): Promise<boolean> {
    const item = await this.prisma.newsItem.findUnique({
      where: { url },
      select: { id: true },
    });
    return item !== null;
  }

  /**
   * Check multiple URLs at once (batch dedup)
   */
  async urlsExist(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) return new Set();

    const existing = await this.prisma.newsItem.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });

    return new Set(existing.map((item) => item.url));
  }

  /**
   * Create a new news item
   */
  async create(data: Prisma.NewsItemCreateInput) {
    return this.prisma.newsItem.create({ data });
  }

  /**
   * Create multiple news items (batch insert)
   */
  async createMany(data: Prisma.NewsItemCreateManyInput[]) {
    return this.prisma.newsItem.createMany({
      data,
      skipDuplicates: true, // Skip if URL already exists
    });
  }

  /**
   * Find news items with pagination and filters
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.NewsItemWhereInput;
    orderBy?: Prisma.NewsItemOrderByWithRelationInput;
  }) {
    return this.prisma.newsItem.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      orderBy: params.orderBy || { publishedAt: 'desc' },
      include: {
        tags: { include: { tag: true } },
        tickers: { include: { ticker: true } },
      },
    });
  }

  /**
   * Count news items with filters
   */
  async count(where?: Prisma.NewsItemWhereInput) {
    return this.prisma.newsItem.count({ where });
  }

  /**
   * Delete news item by ID
   */
  async delete(id: string) {
    return this.prisma.newsItem.delete({ where: { id } });
  }

  /**
   * Build where clause from filters
   */
  buildWhereClause(filters: NewsQueryFilters): Prisma.NewsItemWhereInput {
    const where: Prisma.NewsItemWhereInput = {};

    // Single source
    if (filters.source) {
      where.source = filters.source;
    }

    // Multiple sources
    if (filters.sources?.length) {
      where.source = { in: filters.sources };
    }

    // Language
    if (filters.language) {
      where.language = filters.language;
    }

    // Date range
    if (filters.from || filters.to) {
      where.publishedAt = {};
      if (filters.from) {
        where.publishedAt.gte = filters.from;
      }
      if (filters.to) {
        where.publishedAt.lte = filters.to;
      }
    }

    // Search in title/summary
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { summary: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Filter by tag names
    if (filters.tagNames?.length) {
      where.tags = {
        some: {
          tag: {
            name: { in: filters.tagNames },
          },
        },
      };
    }

    // Filter by ticker symbols and/or market
    if (filters.tickerSymbols?.length || filters.market) {
      where.tickers = {
        some: {
          ticker: {
            ...(filters.tickerSymbols?.length && {
              symbol: { in: filters.tickerSymbols },
            }),
            ...(filters.market && { market: filters.market }),
          },
        },
      };
    }

    return where;
  }

  /**
   * Find news with pagination and filters (combined query)
   */
  async findWithFilters(
    filters: NewsQueryFilters,
    options: {
      skip?: number;
      take?: number;
      sortBy?: 'publishedAt' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{ items: any[]; total: number }> {
    const where = this.buildWhereClause(filters);
    const orderBy = {
      [options.sortBy || 'publishedAt']: options.sortOrder || 'desc',
    };

    const [items, total] = await Promise.all([
      this.prisma.newsItem.findMany({
        where,
        skip: options.skip || 0,
        take: options.take || 20,
        orderBy,
        include: {
          tags: { include: { tag: true } },
          tickers: { include: { ticker: true } },
        },
      }),
      this.prisma.newsItem.count({ where }),
    ]);

    return { items, total };
  }
}
