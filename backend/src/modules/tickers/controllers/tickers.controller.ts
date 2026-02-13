import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TickersService } from '../services/tickers.service';
import { TickerQueryDto, TickerDto } from '../dto/ticker.dto';
import {
  ApiResponseDto,
  PaginatedResponseDto,
} from '../../../shared/dto/api-response.dto';

/**
 * TickersController
 *
 * Public API endpoints for ticker queries.
 *
 * Endpoints:
 * - GET /api/v1/tickers - List/search tickers
 */
@ApiTags('Tickers')
@Controller('api/v1/tickers')
export class TickersController {
  constructor(private readonly tickersService: TickersService) {}

  /**
   * GET /api/v1/tickers
   *
   * List tickers with search and market filter.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List tickers',
    description:
      'Retrieve paginated list of tickers with optional search and market filter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tickers',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async listTickers(
    @Query() query: TickerQueryDto,
  ): Promise<ApiResponseDto<PaginatedResponseDto<TickerDto>>> {
    const result = await this.tickersService.list(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * GET /api/v1/tickers/all
   *
   * Get all tickers (for autocomplete, no pagination).
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tickers',
    description:
      'Retrieve all tickers without pagination (for autocomplete/dropdowns).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all tickers',
  })
  async getAllTickers(): Promise<ApiResponseDto<TickerDto[]>> {
    const tickers = await this.tickersService.getAll();
    return ApiResponseDto.ok(tickers);
  }
}
