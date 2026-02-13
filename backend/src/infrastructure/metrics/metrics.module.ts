import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * MetricsModule
 *
 * Provides metrics collection across the application.
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
