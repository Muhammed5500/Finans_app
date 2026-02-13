import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NewsSource } from '@prisma/client';
import { IngestionService } from './ingestion.service';

/**
 * IngestionScheduler
 *
 * Cron-based scheduler for periodic ingestion from all sources.
 *
 * Default intervals:
 * - GDELT: Every 15 minutes
 * - SEC RSS: Every 30 minutes
 * - KAP: Every 10 minutes
 * - Google News: Every 60 minutes (if enabled)
 *
 * All schedules are configurable via environment variables.
 */
@Injectable()
export class IngestionScheduler implements OnModuleInit {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  onModuleInit() {
    this.logger.log('Ingestion scheduler initialized');
    // TODO: Log enabled sources and their intervals
  }

  /**
   * GDELT ingestion - every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES) // TODO: Make configurable
  async ingestGdelt() {
    if (!this.config.get<boolean>('GDELT_ENABLED', true)) {
      return;
    }

    // TODO: Implement scheduled GDELT ingestion
    //
    // Steps:
    // 1. Check if previous run is still in progress (skip if so)
    // 2. Call ingestionService.ingest(NewsSourceType.GDELT)
    // 3. Log results

    this.logger.debug('TODO: Scheduled GDELT ingestion');
  }

  /**
   * SEC RSS ingestion - every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async ingestSecRss() {
    if (!this.config.get<boolean>('SEC_RSS_ENABLED', true)) {
      return;
    }

    // TODO: Implement scheduled SEC RSS ingestion
    this.logger.debug('TODO: Scheduled SEC RSS ingestion');
  }

  /**
   * KAP ingestion - every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async ingestKap() {
    if (!this.config.get<boolean>('KAP_ENABLED', true)) {
      return;
    }

    // TODO: Implement scheduled KAP ingestion
    this.logger.debug('TODO: Scheduled KAP ingestion');
  }

  /**
   * Google News ingestion - every hour (optional)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async ingestGoogleNews() {
    if (!this.config.get<boolean>('GOOGLE_NEWS_ENABLED', false)) {
      return;
    }

    // TODO: Implement scheduled Google News ingestion
    this.logger.debug('TODO: Scheduled Google News ingestion (optional)');
  }

  /**
   * Manual trigger for a specific source
   */
  async triggerManual(sourceType: NewsSource) {
    this.logger.log(`Manual ingestion triggered for ${sourceType}`);
    return this.ingestionService.ingest(sourceType);
  }

  /**
   * Manual trigger for all sources
   */
  async triggerAll() {
    this.logger.log('Manual ingestion triggered for all sources');
    return this.ingestionService.ingestAll();
  }
}
