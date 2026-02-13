import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NewsSource } from '@prisma/client';
import { NewsQueryService } from '../services/news-query.service';

/**
 * AdminNewsController
 *
 * Admin API endpoints for news and ingestion management.
 *
 * Endpoints:
 * - POST /api/v1/admin/ingestion/trigger - Trigger manual ingestion
 * - GET /api/v1/admin/ingestion/runs - List ingestion runs
 * - GET /api/v1/admin/ingestion/status - Get ingestion status
 * - PATCH /api/v1/admin/sources/:id - Update source configuration
 * - DELETE /api/v1/admin/news/:id - Delete news item
 *
 * Note: In production, these endpoints should be protected by authentication.
 */
@Controller('api/v1/admin')
export class AdminNewsController {
  constructor(private readonly newsService: NewsQueryService) {}

  /**
   * POST /api/v1/admin/ingestion/trigger
   *
   * Trigger manual ingestion for one or all sources.
   */
  @Post('ingestion/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerIngestion(@Body() body: { source?: NewsSource }) {
    // TODO: Implement manual ingestion trigger
    //
    // Steps:
    // 1. Validate source type (if provided)
    // 2. Call IngestionScheduler.triggerManual() or triggerAll()
    // 3. Return job ID or acknowledgment

    return {
      message: 'TODO: Trigger ingestion',
      source: body.source || 'all',
      status: 'pending',
    };
  }

  /**
   * GET /api/v1/admin/ingestion/runs
   *
   * List recent ingestion runs with stats.
   */
  @Get('ingestion/runs')
  @HttpCode(HttpStatus.OK)
  async listIngestionRuns() {
    // TODO: Implement ingestion runs listing
    //
    // Steps:
    // 1. Query IngestionRun table
    // 2. Return paginated list with stats

    return {
      runs: [],
      total: 0,
    };
  }

  /**
   * GET /api/v1/admin/ingestion/status
   *
   * Get current ingestion status for all sources.
   */
  @Get('ingestion/status')
  @HttpCode(HttpStatus.OK)
  async getIngestionStatus() {
    // TODO: Implement status endpoint
    //
    // Return:
    // - Each source's last run time
    // - Each source's last status
    // - Next scheduled run time

    return {
      sources: [
        { type: 'GDELT', enabled: true, lastRun: null, nextRun: null },
        { type: 'SEC_RSS', enabled: true, lastRun: null, nextRun: null },
        { type: 'KAP', enabled: true, lastRun: null, nextRun: null },
        {
          type: 'GOOGLE_NEWS_RSS',
          enabled: false,
          lastRun: null,
          nextRun: null,
        },
      ],
    };
  }

  /**
   * PATCH /api/v1/admin/sources/:id
   *
   * Update a news source configuration.
   */
  @Patch('sources/:id')
  @HttpCode(HttpStatus.OK)
  async updateSource(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; fetchIntervalMinutes?: number },
  ) {
    // TODO: Implement source update
    //
    // Steps:
    // 1. Find source by ID
    // 2. Update fields
    // 3. Return updated source

    return {
      message: 'TODO: Update source',
      id,
      updates: body,
    };
  }

  /**
   * DELETE /api/v1/admin/news/:id
   *
   * Delete a news item.
   */
  @Delete('news/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNewsItem(@Param('id') _id: string) {
    // TODO: Implement news deletion
    //
    // Steps:
    // 1. Find news item by ID
    // 2. Delete (soft delete or hard delete?)
    // 3. Return 204 No Content

    return;
  }
}
