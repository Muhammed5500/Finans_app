import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsSource } from '@prisma/client';

/**
 * Ticker reference in news response
 */
export class TickerRefDto {
  @ApiProperty({
    description: 'Ticker ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Ticker symbol', example: 'AAPL' })
  symbol: string;

  @ApiPropertyOptional({
    description: 'Company/asset name',
    example: 'Apple Inc.',
  })
  name?: string;

  @ApiProperty({ description: 'Market type', example: 'USA' })
  market: string;
}

/**
 * Tag reference in news response
 */
export class TagRefDto {
  @ApiProperty({
    description: 'Tag ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Tag name', example: 'earnings' })
  name: string;
}

/**
 * News item response DTO
 */
export class NewsItemDto {
  @ApiProperty({
    description: 'News item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'News source',
    enum: NewsSource,
    example: 'GDELT',
  })
  source: NewsSource;

  @ApiPropertyOptional({
    description: 'Source-specific ID',
    example: 'gdelt-12345',
  })
  sourceId?: string;

  @ApiProperty({
    description: 'Article title',
    example: 'Tesla reports strong Q4 earnings',
  })
  title: string;

  @ApiProperty({
    description: 'Article URL',
    example: 'https://example.com/article',
  })
  url: string;

  @ApiProperty({
    description: 'Publication date',
    example: '2024-01-15T16:30:00Z',
  })
  publishedAt: Date;

  @ApiProperty({ description: 'Language code', example: 'en' })
  language: string;

  @ApiPropertyOptional({ description: 'Article summary' })
  summary?: string;

  @ApiProperty({
    description: 'When the item was discovered',
    example: '2024-01-15T16:35:00Z',
  })
  createdAt: Date;

  @ApiProperty({ description: 'Related tickers', type: [TickerRefDto] })
  tickers: TickerRefDto[];

  @ApiProperty({ description: 'Related tags', type: [TagRefDto] })
  tags: TagRefDto[];
}

/**
 * News item detail response (includes raw data)
 */
export class NewsItemDetailDto extends NewsItemDto {
  @ApiPropertyOptional({ description: 'Raw data from source' })
  raw?: Record<string, unknown>;
}
