import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { DbHealthIndicator } from './indicators/db-health.indicator';
import { IngestionHealthIndicator } from './indicators/ingestion-health.indicator';
import { JobsModule } from '../jobs/jobs.module';

/**
 * HealthModule
 *
 * Provides health check endpoints for monitoring and orchestration.
 *
 * Endpoints:
 * - GET /health - Basic health check
 * - GET /health/live - Liveness probe (K8s)
 * - GET /health/ready - Readiness probe (K8s)
 * - GET /health/collectors - Collector run status
 * - GET /health/collectors/:name - Single collector status
 *
 * Indicators:
 * - Database connectivity
 * - Ingestion status
 */
@Module({
  imports: [forwardRef(() => JobsModule)],
  controllers: [HealthController],
  providers: [DbHealthIndicator, IngestionHealthIndicator],
  exports: [DbHealthIndicator, IngestionHealthIndicator],
})
export class HealthModule {}
