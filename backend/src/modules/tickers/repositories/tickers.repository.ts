import { Injectable, Logger } from '@nestjs/common';
import { Market, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * TickersRepository
 *
 * Data access layer for tickers and news-ticker associations.
 */
@Injectable()
export class TickersRepository {
  private readonly logger = new Logger(TickersRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find ticker by symbol
   */
  async findBySymbol(symbol: string) {
    return this.prisma.ticker.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
  }

  /**
   * Find multiple tickers by symbols
   */
  async findBySymbols(symbols: string[]) {
    return this.prisma.ticker.findMany({
      where: {
        symbol: { in: symbols.map((s) => s.toUpperCase()) },
      },
    });
  }

  /**
   * Create a new ticker
   */
  async create(data: { symbol: string; name?: string; market: Market }) {
    return this.prisma.ticker.create({
      data: {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        market: data.market,
      },
    });
  }

  /**
   * Find or create a ticker
   */
  async upsert(data: { symbol: string; name?: string; market: Market }) {
    return this.prisma.ticker.upsert({
      where: { symbol: data.symbol.toUpperCase() },
      create: {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        market: data.market,
      },
      update: {
        name: data.name || undefined,
      },
    });
  }

  /**
   * List all tickers with filters
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    market?: Market;
    search?: string;
  }) {
    const where: Prisma.TickerWhereInput = {};

    if (params.market) {
      where.market = params.market;
    }

    if (params.search) {
      where.OR = [
        { symbol: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.ticker.findMany({
      skip: params.skip,
      take: params.take,
      where,
      orderBy: { symbol: 'asc' },
    });
  }

  /**
   * Count tickers
   */
  async count(where?: Prisma.TickerWhereInput) {
    return this.prisma.ticker.count({ where });
  }

  /**
   * Find tickers with filters and counts
   */
  async findWithFilters(params: {
    skip?: number;
    take?: number;
    market?: Market;
    search?: string;
  }): Promise<{ items: any[]; total: number }> {
    const where: Prisma.TickerWhereInput = {};

    if (params.market) {
      where.market = params.market;
    }

    if (params.search) {
      where.OR = [
        { symbol: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.ticker.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { symbol: 'asc' },
        include: {
          _count: {
            select: { newsItems: true },
          },
        },
      }),
      this.prisma.ticker.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get all tickers (for tagging service)
   */
  async findAll() {
    return this.prisma.ticker.findMany({
      orderBy: { symbol: 'asc' },
    });
  }

  /**
   * Associate a ticker with a news item
   */
  async associateWithNews(
    newsItemId: string,
    tickerId: string,
    confidence: number = 1.0,
  ) {
    return this.prisma.newsItemTicker.upsert({
      where: {
        newsItemId_tickerId: { newsItemId, tickerId },
      },
      create: {
        newsItemId,
        tickerId,
        confidence,
      },
      update: {
        confidence,
      },
    });
  }

  /**
   * Associate multiple tickers with a news item
   */
  async associateManyWithNews(
    newsItemId: string,
    tickerAssociations: Array<{ tickerId: string; confidence: number }>,
  ) {
    const operations = tickerAssociations.map((assoc) =>
      this.prisma.newsItemTicker.upsert({
        where: {
          newsItemId_tickerId: { newsItemId, tickerId: assoc.tickerId },
        },
        create: {
          newsItemId,
          tickerId: assoc.tickerId,
          confidence: assoc.confidence,
        },
        update: {
          confidence: assoc.confidence,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  /**
   * Get news items for a ticker
   */
  async getNewsForTicker(
    tickerId: string,
    params: { skip?: number; take?: number },
  ) {
    return this.prisma.newsItemTicker.findMany({
      where: { tickerId },
      skip: params.skip,
      take: params.take,
      include: { newsItem: true },
      orderBy: { newsItem: { publishedAt: 'desc' } },
    });
  }

  /**
   * Get tickers for a news item
   */
  async getTickersForNews(newsItemId: string) {
    return this.prisma.newsItemTicker.findMany({
      where: { newsItemId },
      include: { ticker: true },
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Count news items for a ticker
   */
  async countNewsForTicker(tickerId: string) {
    return this.prisma.newsItemTicker.count({
      where: { tickerId },
    });
  }
}
