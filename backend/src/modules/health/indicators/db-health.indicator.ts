import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Health indicator result
 */
export interface HealthIndicatorResult {
  status: 'ok' | 'degraded' | 'error';
  latency?: number;
  message?: string;
}

/**
 * DbHealthIndicator
 *
 * Checks database connectivity and response time.
 */
@Injectable()
export class DbHealthIndicator {
  private readonly logger = new Logger(DbHealthIndicator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check database health
   */
  async check(): Promise<HealthIndicatorResult> {
    // TODO: Implement database health check
    //
    // Steps:
    // 1. Execute simple query (SELECT 1)
    // 2. Measure latency
    // 3. Return status based on latency threshold
    //    - < 100ms: ok
    //    - < 500ms: degraded
    //    - timeout: error

    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: latency < 100 ? 'ok' : latency < 500 ? 'degraded' : 'error',
        latency,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        message: 'Database connection failed',
      };
    }
  }
}
