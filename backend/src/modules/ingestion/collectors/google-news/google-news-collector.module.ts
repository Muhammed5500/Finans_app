import { Module } from '@nestjs/common';
import { GoogleNewsRssCollectorService } from './google-news-collector.service';

/**
 * GoogleNewsCollectorModule
 *
 * Provides Google News RSS collection service.
 * Controlled by feature flag: ENABLE_GOOGLE_NEWS_RSS
 */
@Module({
  providers: [GoogleNewsRssCollectorService],
  exports: [GoogleNewsRssCollectorService],
})
export class GoogleNewsCollectorModule {}
