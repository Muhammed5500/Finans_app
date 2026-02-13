import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Market } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

/**
 * Query parameters for listing/searching tickers
 */
export class TickerQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by symbol or name (partial match)',
    example: 'AAPL',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by market type',
    enum: Market,
    example: 'USA',
  })
  @IsOptional()
  @IsEnum(Market)
  market?: Market;
}

/**
 * Ticker response DTO
 */
export class TickerDto {
  @ApiProperty({
    description: 'Ticker ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Ticker symbol', example: 'AAPL' })
  symbol: string;

  @ApiProperty({ description: 'Market type', enum: Market, example: 'USA' })
  market: Market;

  @ApiPropertyOptional({
    description: 'Company/asset name',
    example: 'Apple Inc.',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Number of news items mentioning this ticker',
  })
  newsCount?: number;
}
