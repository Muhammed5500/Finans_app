import { Injectable, Logger } from '@nestjs/common';
import { TagsRepository } from '../repositories/tags.repository';
import { CacheService } from '../../../infrastructure/cache';
import { TagQueryDto, TagDto } from '../dto/tag.dto';
import { PaginatedResponseDto } from '../../../shared/dto/api-response.dto';

/**
 * TagsService
 *
 * Business logic for tag queries.
 */
@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(
    private readonly tagsRepo: TagsRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * List tags with pagination and search
   */
  async list(query: TagQueryDto): Promise<PaginatedResponseDto<TagDto>> {
    const cacheKey = CacheService.key(
      'tags:list',
      query.page,
      query.pageSize,
      query.search,
    );

    const cached = this.cache.get<PaginatedResponseDto<TagDto>>(cacheKey);
    if (cached) {
      return cached;
    }

    const { items, total } = await this.tagsRepo.findWithFilters({
      skip: query.skip,
      take: query.take,
      search: query.search,
    });

    const mappedItems: TagDto[] = items.map((item) => ({
      id: item.id,
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
   * Get all tags (for autocomplete, no pagination)
   */
  async getAll(): Promise<TagDto[]> {
    const cacheKey = 'tags:all';

    const cached = this.cache.get<TagDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tags = await this.tagsRepo.findAll();

    const mapped: TagDto[] = tags.map((t) => ({
      id: t.id,
      name: t.name,
      newsCount: t._count?.newsItems || 0,
    }));

    this.cache.set(cacheKey, mapped, this.CACHE_TTL);
    return mapped;
  }
}
