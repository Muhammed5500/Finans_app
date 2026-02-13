import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { HealthIndicatorResult } from './db-health.indicator';

/**
 * IngestionHealthIndicator
 *
 * Checks ingestion system health by verifying recent cursor updates.
 */
@Injectable()
export class IngestionHealthIndicator {
  private readonly logger = new Logger(IngestionHealthIndicator.name);

  // Max time since last cursor update before considered unhealthy
  private readonly MAX_AGE_HOURS = 2;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check ingestion health by examining cursor freshness
   */
  async check(): Promise<HealthIndicatorResult> {
    try {
      // Get the most recently updated cursor
      const latestCursor = await this.prisma.ingestionCursor.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true, source: true },
      });

      if (!latestCursor) {
        // No cursors yet - might be fresh deployment
        return {
          status: 'degraded',
          message:
            'No ingestion cursors found - ingestion may not have run yet',
        };
      }

      const ageHours =
        (Date.now() - latestCursor.updatedAt.getTime()) / (1000 * 60 * 60);

      return {
        status:
          ageHours < 1
            ? 'ok'
            : ageHours < this.MAX_AGE_HOURS
              ? 'degraded'
              : 'error',
        latency: undefined,
        message:
          ageHours > this.MAX_AGE_HOURS
            ? `Ingestion is stale - last update ${Math.round(ageHours)}h ago`
            : undefined,
      };
    } catch (error) {
      this.logger.error('Ingestion health check failed', error);
      return {
        status: 'error',
        message: 'Failed to check ingestion status',
      };
    }
  }
}
