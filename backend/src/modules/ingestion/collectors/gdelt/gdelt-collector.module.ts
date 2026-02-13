import { Module } from '@nestjs/common';
import { GdeltCollectorService } from './gdelt-collector.service';

/**
 * GdeltCollectorModule
 *
 * Provides GDELT news collection service.
 */
@Module({
  providers: [GdeltCollectorService],
  exports: [GdeltCollectorService],
})
export class GdeltCollectorModule {}
