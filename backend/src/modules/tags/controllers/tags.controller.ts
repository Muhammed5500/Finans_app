import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TagsService } from '../services/tags.service';
import { TagQueryDto, TagDto } from '../dto/tag.dto';
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from '../../../shared/dto/api-response.dto';

/**
 * TagsController
 *
 * Public API endpoints for tag queries.
 *
 * Endpoints:
 * - GET /api/v1/tags - List/search tags
 */
@ApiTags('Tags')
@Controller('api/v1/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * GET /api/v1/tags
   *
   * List tags with optional search.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List tags',
    description: 'Retrieve paginated list of tags with optional search filter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tags',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async listTags(
    @Query() query: TagQueryDto,
  ): Promise<ApiResponseDto<PaginatedResponseDto<TagDto>>> {
    const result = await this.tagsService.list(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * GET /api/v1/tags/all
   *
   * Get all tags (for autocomplete, no pagination).
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tags',
    description:
      'Retrieve all tags without pagination (for autocomplete/dropdowns).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all tags',
  })
  async getAllTags(): Promise<ApiResponseDto<TagDto[]>> {
    const tags = await this.tagsService.getAll();
    return ApiResponseDto.ok(tags);
  }
}
