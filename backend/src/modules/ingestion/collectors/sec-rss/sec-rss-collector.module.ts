import { Module } from '@nestjs/common';
import { SecRssCollectorService } from './sec-rss-collector.service';

/**
 * SecRssCollectorModule
 *
 * Provides SEC RSS feed collection service.
 */
@Module({
  providers: [SecRssCollectorService],
  exports: [SecRssCollectorService],
})
export class SecRssCollectorModule {}
