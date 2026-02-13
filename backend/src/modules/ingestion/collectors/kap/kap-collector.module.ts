import { Module } from '@nestjs/common';
import { KapCollectorService } from './kap-collector.service';

/**
 * KapCollectorModule
 *
 * Provides KAP (Kamuyu Aydınlatma Platformu) collection service.
 */
@Module({
  providers: [KapCollectorService],
  exports: [KapCollectorService],
})
export class KapCollectorModule {}
