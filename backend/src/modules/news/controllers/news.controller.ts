import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { NewsQueryService } from '../services/news-query.service';
import { NewsQueryDto } from '../dto/news-query.dto';
import { NewsItemDto, NewsItemDetailDto } from '../dto/news-response.dto';
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from '../../../shared/dto/api-response.dto';

/**
 * NewsController
 *
 * Public API endpoints for news queries.
 *
 * Endpoints:
 * - GET /api/v1/news - List news (paginated with filters)
 * - GET /api/v1/news/:id - Get single news item
 * - GET /api/v1/news/sources - List news sources with counts
 */
@ApiTags('News')
@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsQueryService) {}

  /**
   * GET /api/v1/news
   *
   * List news items with pagination and filters.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List news items',
    description:
      'Retrieve paginated news items with optional filters for market, ticker, tag, source, date range, and search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of news items',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async listNews(
    @Query() query: NewsQueryDto,
  ): Promise<ApiResponseDto<PaginatedResponseDto<NewsItemDto>>> {
    const result = await this.newsService.list(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * GET /api/v1/news/sources
   *
   * List available news sources with item counts.
   */
  @Get('sources')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List news sources',
    description: 'Get all available news sources with their item counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of news sources with counts',
  })
  async listSources(): Promise<
    ApiResponseDto<{ source: string; count: number }[]>
  > {
    const sources = await this.newsService.getSources();
    return ApiResponseDto.ok(sources);
  }

  /**
   * GET /api/v1/news/:id
   *
   * Get a single news item by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get news item by ID',
    description:
      'Retrieve a single news item with full details including raw source data.',
  })
  @ApiParam({
    name: 'id',
    description: 'News item UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'News item details',
  })
  @ApiResponse({ status: 404, description: 'News item not found' })
  async getNewsById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApiResponseDto<NewsItemDetailDto>> {
    const item = await this.newsService.findById(id);
    return ApiResponseDto.ok(item);
  }
}
