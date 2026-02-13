import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Standard API response wrapper
 */
export class ApiResponseDto<T> {
  @ApiProperty({ description: 'Whether the request was successful' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Response data' })
  data?: T;

  @ApiPropertyOptional({ description: 'Error message if request failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Error code for programmatic handling' })
  errorCode?: string;

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;

  constructor(data?: T, error?: string, errorCode?: string) {
    this.success = !error;
    this.data = data;
    this.error = error;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T): ApiResponseDto<T> {
    return new ApiResponseDto(data);
  }

  static error<T>(message: string, code?: string): ApiResponseDto<T> {
    return new ApiResponseDto<T>(undefined, message, code);
  }
}

/**
 * Paginated response wrapper
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'List of items' })
  items: T[];

  @ApiProperty({ description: 'Total number of items matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number (1-based)' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  pageSize: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrevious: boolean;

  constructor(items: T[], total: number, page: number, pageSize: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(total / pageSize);
    this.hasNext = page < this.totalPages;
    this.hasPrevious = page > 1;
  }
}

/**
 * Standard paginated API response
 */
export class PaginatedApiResponseDto<T> extends ApiResponseDto<
  PaginatedResponseDto<T>
> {
  constructor(items: T[], total: number, page: number, pageSize: number) {
    super(new PaginatedResponseDto(items, total, page, pageSize));
  }
}
