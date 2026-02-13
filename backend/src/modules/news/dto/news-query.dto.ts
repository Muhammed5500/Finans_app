import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDate,
  IsArray,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { NewsSource, Market } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

/**
 * Query parameters for listing news
 */
export class NewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by market type',
    enum: Market,
    example: 'USA',
  })
  @IsOptional()
  @IsEnum(Market)
  market?: Market;

  @ApiPropertyOptional({
    description: 'Filter by ticker symbol(s)',
    example: 'AAPL',
    type: String,
  })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple ticker symbols (comma-separated)',
    example: 'AAPL,TSLA,MSFT',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((t: string) => t.trim())
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tickers?: string[];

  @ApiPropertyOptional({
    description: 'Filter by tag name',
    example: 'earnings',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple tags (comma-separated)',
    example: 'earnings,macro',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((t: string) => t.trim())
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Filter by news source',
    enum: NewsSource,
    example: 'GDELT',
  })
  @IsOptional()
  @IsEnum(NewsSource)
  source?: NewsSource;

  @ApiPropertyOptional({
    description: 'Filter by language code',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    description: 'End date for date range filter (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    description: 'Search in title (partial match)',
    example: 'earnings',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['publishedAt', 'createdAt'],
    default: 'publishedAt',
  })
  @IsOptional()
  @IsEnum(['publishedAt', 'createdAt'])
  sortBy?: 'publishedAt' | 'createdAt' = 'publishedAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Parameters for getting a single news item
 */
export class NewsIdParamDto {
  @ApiPropertyOptional({
    description: 'News item ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;
}
