import { Module } from '@nestjs/common';
import { IngestionService } from './services/ingestion.service';
import { IngestionScheduler } from './services/ingestion.scheduler';
import { NormalizationService } from './services/normalization.service';
import { DedupService } from './services/dedup.service';

// Collectors
import {
  GdeltCollectorService,
  GdeltCollectorModule,
} from './collectors/gdelt';
import {
  SecRssCollectorService,
  SecRssCollectorModule,
} from './collectors/sec-rss';
import { KapCollectorService, KapCollectorModule } from './collectors/kap';
import {
  GoogleNewsRssCollectorService,
  GoogleNewsCollectorModule,
} from './collectors/google-news';

// Shared modules
import { TaggingModule } from '../../shared/tagging';

/**
 * IngestionModule
 *
 * Manages all data collectors for free news sources:
 * - GDELT 2.1 DOC API
 * - SEC EDGAR Atom/RSS
 * - KAP (kap.org.tr)
 * - Google News RSS (optional, behind feature flag)
 *
 * Features:
 * - Polite rate limiting per source
 * - Cron-based scheduling
 * - Retry with exponential backoff
 * - Deduplication via URL uniqueness
 */
@Module({
  imports: [
    GdeltCollectorModule,
    SecRssCollectorModule,
    KapCollectorModule,
    GoogleNewsCollectorModule,
    TaggingModule,
  ],
  providers: [
    // Core Services
    IngestionService,
    IngestionScheduler,
    NormalizationService,
    DedupService,

    // Collector registry token
    {
      provide: 'COLLECTORS',
      useFactory: (
        gdelt: GdeltCollectorService,
        secRss: SecRssCollectorService,
        kap: KapCollectorService,
        googleNews: GoogleNewsRssCollectorService,
      ) => [gdelt, secRss, kap, googleNews],
      inject: [
        GdeltCollectorService,
        SecRssCollectorService,
        KapCollectorService,
        GoogleNewsRssCollectorService,
      ],
    },
  ],
  exports: [
    IngestionService,
    NormalizationService,
    DedupService,
    // Re-export collector modules so their services are accessible
    GdeltCollectorModule,
    SecRssCollectorModule,
    KapCollectorModule,
    GoogleNewsCollectorModule,
  ],
})
export class IngestionModule {}
