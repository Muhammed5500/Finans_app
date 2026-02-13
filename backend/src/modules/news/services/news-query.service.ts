import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NewsSource } from '@prisma/client';
import {
  NewsRepository,
  NewsQueryFilters,
} from '../repositories/news.repository';
import { CacheService } from '../../../infrastructure/cache';
import { NewsQueryDto } from '../dto/news-query.dto';
import {
  NewsItemDto,
  NewsItemDetailDto,
  TickerRefDto,
  TagRefDto,
} from '../dto/news-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/api-response.dto';

/**
 * NewsQueryService
 *
 * Business logic for news queries.
 *
 * Features:
 * - Paginated listing with filters
 * - Full-text search
 * - Caching for list endpoints
 */
@Injectable()
export class NewsQueryService {
  private readonly logger = new Logger(NewsQueryService.name);
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    private readonly newsRepo: NewsRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * List news items with pagination and filters
   */
  async list(query: NewsQueryDto): Promise<PaginatedResponseDto<NewsItemDto>> {
    // Build cache key from query params
    const cacheKey = CacheService.key(
      'news:list',
      query.page,
      query.pageSize,
      query.source,
      query.market,
      query.ticker,
      query.tickers?.join(','),
      query.tag,
      query.tags?.join(','),
      query.language,
      query.from?.toISOString(),
      query.to?.toISOString(),
      query.search,
      query.sortBy,
      query.sortOrder,
    );

    // Try cache first
    const cached = this.cache.get<PaginatedResponseDto<NewsItemDto>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build filters
    const filters: NewsQueryFilters = {};

    if (query.source) {
      filters.source = query.source;
    }

    if (query.market) {
      filters.market = query.market;
    }

    // Handle single ticker or multiple tickers
    const tickerSymbols: string[] = [];
    if (query.ticker) {
      tickerSymbols.push(query.ticker.toUpperCase());
    }
    if (query.tickers?.length) {
      tickerSymbols.push(...query.tickers.map((t) => t.toUpperCase()));
    }
    if (tickerSymbols.length > 0) {
      filters.tickerSymbols = [...new Set(tickerSymbols)];
    }

    // Handle single tag or multiple tags
    const tagNames: string[] = [];
    if (query.tag) {
      tagNames.push(query.tag.toLowerCase());
    }
    if (query.tags?.length) {
      tagNames.push(...query.tags.map((t) => t.toLowerCase()));
    }
    if (tagNames.length > 0) {
      filters.tagNames = [...new Set(tagNames)];
    }

    if (query.language) {
      filters.language = query.language;
    }

    if (query.from) {
      filters.from = query.from;
    }

    if (query.to) {
      filters.to = query.to;
    }

    if (query.search) {
      filters.search = query.search;
    }

    // Execute query
    const { items, total } = await this.newsRepo.findWithFilters(filters, {
      skip: query.skip,
      take: query.take,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    // Map to DTOs
    const mappedItems = items.map((item) => this.mapToDto(item));

    const response = new PaginatedResponseDto(
      mappedItems,
      total,
      query.page ?? 1,
      query.pageSize ?? 20,
    );

    // Cache the response
    this.cache.set(cacheKey, response, this.CACHE_TTL);

    return response;
  }

  /**
   * Find news item by ID
   */
  async findById(id: string): Promise<NewsItemDetailDto> {
    // Try cache first
    const cacheKey = CacheService.key('news:item', id);
    const cached = this.cache.get<NewsItemDetailDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const item = await this.newsRepo.findById(id);

    if (!item) {
      throw new NotFoundException(`News item not found: ${id}`);
    }

    const dto = this.mapToDetailDto(item);

    // Cache for longer since individual items don't change
    this.cache.set(cacheKey, dto, 60000); // 1 minute

    return dto;
  }

  /**
   * Get news sources with statistics
   */
  async getSources(): Promise<{ source: NewsSource; count: number }[]> {
    const cacheKey = 'news:sources';
    const cached =
      this.cache.get<{ source: NewsSource; count: number }[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // This would ideally be a groupBy query
    const sources = Object.values(NewsSource);
    const counts = await Promise.all(
      sources.map(async (source) => {
        const count = await this.newsRepo.count({ source });
        return { source, count };
      }),
    );

    this.cache.set(cacheKey, counts, this.CACHE_TTL);
    return counts;
  }

  /**
   * Clear news list cache (call after ingestion)
   */
  clearListCache(): void {
    this.cache.deletePattern('news:list*');
    this.cache.deletePattern('news:sources');
  }

  /**
   * Map database item to DTO
   */
  private mapToDto(item: any): NewsItemDto {
    return {
      id: item.id,
      source: item.source,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      language: item.language,
      summary: item.summary,
      createdAt: item.createdAt,
      tickers: item.tickers?.map((t: any) => this.mapTickerRef(t.ticker)) || [],
      tags: item.tags?.map((t: any) => this.mapTagRef(t.tag)) || [],
    };
  }

  /**
   * Map database item to detail DTO (includes raw)
   */
  private mapToDetailDto(item: any): NewsItemDetailDto {
    return {
      ...this.mapToDto(item),
      raw: item.raw as Record<string, unknown>,
    };
  }

  /**
   * Map ticker to ref DTO
   */
  private mapTickerRef(ticker: any): TickerRefDto {
    return {
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      market: ticker.market,
    };
  }

  /**
   * Map tag to ref DTO
   */
  private mapTagRef(tag: any): TagRefDto {
    return {
      id: tag.id,
      name: tag.name,
    };
  }
}
