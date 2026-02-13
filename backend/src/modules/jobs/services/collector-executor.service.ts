import { Injectable, Logger } from '@nestjs/common';
import { CollectorJob, JobResult } from '../jobs.types';
import { RunTrackerService } from './run-tracker.service';
import { GdeltCollectorService } from '../../ingestion/collectors/gdelt';
import { SecRssCollectorService } from '../../ingestion/collectors/sec-rss';
import { KapCollectorService } from '../../ingestion/collectors/kap';
import { GoogleNewsRssCollectorService } from '../../ingestion/collectors/google-news';

/**
 * CollectorExecutorService
 *
 * Executes collectors and tracks their results.
 * Shared by both BullMQ and cron-based schedulers.
 */
@Injectable()
export class CollectorExecutorService {
  private readonly logger = new Logger(CollectorExecutorService.name);

  constructor(
    private readonly runTracker: RunTrackerService,
    private readonly gdeltCollector: GdeltCollectorService,
    private readonly secRssCollector: SecRssCollectorService,
    private readonly kapCollector: KapCollectorService,
    private readonly googleNewsCollector: GoogleNewsRssCollectorService,
  ) {}

  /**
   * Execute a collector job
   */
  async execute(job: CollectorJob): Promise<JobResult> {
    const startTime = Date.now();

    this.logger.log(`Executing job: ${job}`);
    this.runTracker.markStarted(job);

    try {
      const result = await this.executeCollector(job);
      const duration = Date.now() - startTime;

      const jobResult: JobResult = {
        success: true,
        itemsFound: result.itemsFound,
        itemsNew: result.itemsNew,
        duration,
      };

      this.runTracker.markCompleted(job, jobResult);
      this.logger.log(
        `Job ${job} completed: ${result.itemsNew} new items (${duration}ms)`,
      );

      return jobResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      const jobResult: JobResult = {
        success: false,
        error: errorMsg,
        duration,
      };

      this.runTracker.markCompleted(job, jobResult);
      this.logger.error(`Job ${job} failed: ${errorMsg}`);

      return jobResult;
    }
  }

  /**
   * Execute the appropriate collector
   */
  private async executeCollector(
    job: CollectorJob,
  ): Promise<{ itemsFound: number; itemsNew: number }> {
    switch (job) {
      case CollectorJob.GDELT: {
        const results = await this.gdeltCollector.collect();
        return {
          itemsFound: results.reduce((sum, r) => sum + r.itemsFound, 0),
          itemsNew: results.reduce((sum, r) => sum + r.itemsNew, 0),
        };
      }

      case CollectorJob.SEC_RSS: {
        const results = await this.secRssCollector.collect();
        return {
          itemsFound: results.reduce((sum, r) => sum + r.itemsFound, 0),
          itemsNew: results.reduce((sum, r) => sum + r.itemsNew, 0),
        };
      }

      case CollectorJob.KAP: {
        const result = await this.kapCollector.collect();
        return {
          itemsFound: result.itemsFound,
          itemsNew: result.itemsNew,
        };
      }

      case CollectorJob.GOOGLE_NEWS: {
        const results = await this.googleNewsCollector.collect();
        return {
          itemsFound: results.reduce((sum, r) => sum + r.itemsFound, 0),
          itemsNew: results.reduce((sum, r) => sum + r.itemsNew, 0),
        };
      }

      default:
        throw new Error(`Unknown collector job: ${job}`);
    }
  }

  /**
   * Check if a collector is enabled
   */
  isEnabled(job: CollectorJob): boolean {
    switch (job) {
      case CollectorJob.GDELT:
        return this.gdeltCollector.isEnabled();
      case CollectorJob.SEC_RSS:
        return this.secRssCollector.isEnabled();
      case CollectorJob.KAP:
        return this.kapCollector.isEnabled();
      case CollectorJob.GOOGLE_NEWS:
        return this.googleNewsCollector.isEnabled();
      default:
        return false;
    }
  }

  /**
   * Get list of enabled collectors
   */
  getEnabledCollectors(): CollectorJob[] {
    return Object.values(CollectorJob).filter((job) => this.isEnabled(job));
  }
}
