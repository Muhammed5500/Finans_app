import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

/**
 * Query parameters for listing tags
 */
export class TagQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by tag name (partial match)',
    example: 'earn',
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  search?: string;
}

/**
 * Tag response DTO
 */
export class TagDto {
  @ApiProperty({
    description: 'Tag ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Tag name', example: 'earnings' })
  name: string;

  @ApiPropertyOptional({ description: 'Number of news items with this tag' })
  newsCount?: number;
}
