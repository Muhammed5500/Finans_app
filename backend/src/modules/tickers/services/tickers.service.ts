import { Injectable, Logger } from '@nestjs/common';
import { TickersRepository } from '../repositories/tickers.repository';
import { CacheService } from '../../../infrastructure/cache';
import { TickerQueryDto, TickerDto } from '../dto/ticker.dto';
import { PaginatedResponseDto } from '../../../shared/dto/api-response.dto';

/**
 * TickersService
 *
 * Business logic for ticker queries.
 */
@Injectable()
export class TickersService {
  private readonly logger = new Logger(TickersService.name);
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(
    private readonly tickersRepo: TickersRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * List tickers with pagination and filters
   */
  async list(query: TickerQueryDto): Promise<PaginatedResponseDto<TickerDto>> {
    const cacheKey = CacheService.key(
      'tickers:list',
      query.page,
      query.pageSize,
      query.market,
      query.search,
    );

    const cached = this.cache.get<PaginatedResponseDto<TickerDto>>(cacheKey);
    if (cached) {
      return cached;
    }

    const { items, total } = await this.tickersRepo.findWithFilters({
      skip: query.skip,
      take: query.take,
      market: query.market,
      search: query.search,
    });

    const mappedItems: TickerDto[] = items.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      market: item.market,
      name: item.name,
      newsCount: item._count?.newsItems || 0,
    }));

    const response = new PaginatedResponseDto(
      mappedItems,
      total,
      query.page ?? 1,
      query.pageSize ?? 20,
    );

    this.cache.set(cacheKey, response, this.CACHE_TTL);
    return response;
  }

  /**
   * Get all tickers (for autocomplete, no pagination)
   */
  async getAll(): Promise<TickerDto[]> {
    const cacheKey = 'tickers:all';

    const cached = this.cache.get<TickerDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tickers = await this.tickersRepo.findAll();

    const mapped: TickerDto[] = tickers.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      market: t.market,
      name: t.name,
    }));

    this.cache.set(cacheKey, mapped, this.CACHE_TTL);
    return mapped;
  }
}
