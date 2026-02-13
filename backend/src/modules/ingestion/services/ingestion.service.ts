import { Injectable, Logger, Inject } from '@nestjs/common';
import { NewsSource } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ICollector } from '../collectors/collector.interface';
import { NormalizationService } from './normalization.service';
import { DedupService } from './dedup.service';

/**
 * Ingestion run statistics
 */
export interface IngestionStats {
  sourceType: NewsSource;
  startedAt: Date;
  finishedAt?: Date;
  insertedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * IngestionService
 *
 * Orchestrates the ingestion pipeline:
 * 1. Calls collectors to fetch raw items
 * 2. Normalizes items (URL canonicalization, date parsing, etc.)
 * 3. Deduplicates via fingerprints
 * 4. Stores new items in Postgres
 * 5. Updates cursor for incremental fetch
 * 6. Tracks ingestion run statistics
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: NormalizationService,
    private readonly dedup: DedupService,
    @Inject('COLLECTORS') private readonly collectors: ICollector[],
  ) {}

  /**
   * Run ingestion for a specific source type
   */
  async ingest(sourceType: NewsSource): Promise<IngestionStats> {
    // TODO: Implement full ingestion pipeline
    //
    // Steps:
    // 1. Find the collector for this source type
    // 2. Get cursor from database (if exists)
    // 3. Call collector.collect() with cursor
    // 4. For each raw item:
    //    a. Normalize via NormalizationService
    //    b. Generate fingerprint via DedupService
    //    c. Check if fingerprint exists
    //    d. Insert if new, skip if duplicate
    // 5. Update cursor in database
    // 6. Create IngestionRun record
    // 7. Return stats

    this.logger.log(`TODO: Implement ingestion for ${sourceType}`);

    const stats: IngestionStats = {
      sourceType,
      startedAt: new Date(),
      finishedAt: new Date(),
      insertedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    };

    return stats;
  }

  /**
   * Run ingestion for all enabled sources
   */
  async ingestAll(): Promise<Map<NewsSource, IngestionStats>> {
    // TODO: Implement batch ingestion
    //
    // Steps:
    // 1. Filter collectors by isEnabled()
    // 2. Run ingest() for each sequentially (to respect rate limits)
    // 3. Collect and return all stats

    this.logger.log('TODO: Implement batch ingestion');

    const results = new Map<NewsSource, IngestionStats>();

    for (const collector of this.collectors) {
      if (collector.isEnabled()) {
        const stats = await this.ingest(collector.sourceType);
        results.set(collector.sourceType, stats);
      }
    }

    return results;
  }

  /**
   * Get the last ingestion run for a source
   */
  async getLastRun(_sourceType: NewsSource) {
    // TODO: Query IngestionRun table
    return null;
  }

  /**
   * Get ingestion status for all sources
   */
  async getStatus() {
    // TODO: Return status summary for all sources
    return {
      sources: [],
      lastRuns: [],
    };
  }
}
