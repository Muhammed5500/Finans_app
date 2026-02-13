import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CollectorJob, COLLECTOR_CRON } from '../jobs.types';
import { CollectorExecutorService } from './collector-executor.service';
import { RunTrackerService } from './run-tracker.service';

/**
 * CronSchedulerService
 *
 * Fallback scheduler using NestJS ScheduleModule cron jobs.
 * Used when Redis is not available (USE_REDIS_QUEUE=false).
 */
@Injectable()
export class CronSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronSchedulerService.name);
  private isActive = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly executor: CollectorExecutorService,
    private readonly runTracker: RunTrackerService,
  ) {}

  async onModuleInit() {
    const useRedis =
      this.configService.get<string>('USE_REDIS_QUEUE', 'false') === 'true';

    if (useRedis) {
      this.logger.log('Cron scheduler disabled (USE_REDIS_QUEUE=true)');
      return;
    }

    this.logger.log('Initializing cron-based job scheduler');
    this.isActive = true;
    await this.setupJobs();
  }

  async onModuleDestroy() {
    if (this.isActive) {
      this.stopAllJobs();
    }
  }

  /**
   * Setup cron jobs for all enabled collectors
   */
  private async setupJobs(): Promise<void> {
    const enabledCollectors = this.executor.getEnabledCollectors();

    for (const job of enabledCollectors) {
      this.setupJob(job);
    }

    this.logger.log(
      `Cron scheduler ready with ${enabledCollectors.length} collectors: ${enabledCollectors.join(', ')}`,
    );
  }

  /**
   * Setup a single cron job
   */
  private setupJob(collectorJob: CollectorJob): void {
    const cronExpression = COLLECTOR_CRON[collectorJob];
    const jobName = `cron-${collectorJob}`;

    try {
      const cronJob = new CronJob(
        cronExpression,
        async () => {
          await this.runJob(collectorJob);
        },
        null, // onComplete
        true, // start
        'UTC', // timezone
      );

      this.schedulerRegistry.addCronJob(jobName, cronJob);

      // Calculate and set next run time
      const nextDate = cronJob.nextDate();
      if (nextDate) {
        this.runTracker.setNextRunAt(collectorJob, nextDate.toJSDate());
      }

      this.logger.log(`Scheduled ${collectorJob} with cron: ${cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to setup cron job ${collectorJob}: ${error}`);
    }
  }

  /**
   * Run a collector job
   */
  private async runJob(job: CollectorJob): Promise<void> {
    if (!this.isActive) return;

    await this.executor.execute(job);

    // Update next run time
    try {
      const cronJob = this.schedulerRegistry.getCronJob(`cron-${job}`);
      const nextDate = cronJob.nextDate();
      if (nextDate) {
        this.runTracker.setNextRunAt(job, nextDate.toJSDate());
      }
    } catch {
      // Job might not exist
    }
  }

  /**
   * Stop all cron jobs
   */
  private stopAllJobs(): void {
    for (const job of Object.values(CollectorJob)) {
      const jobName = `cron-${job}`;
      try {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.debug(`Stopped cron job: ${jobName}`);
      } catch {
        // Job might not exist
      }
    }
    this.logger.log('All cron jobs stopped');
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(job: CollectorJob): Promise<void> {
    this.logger.log(`Manually triggering job: ${job}`);
    await this.executor.execute(job);
  }

  /**
   * Check if cron scheduler is active
   */
  isSchedulerActive(): boolean {
    return this.isActive;
  }

  /**
   * Get scheduler type
   */
  getSchedulerType(): string {
    return 'cron';
  }
}
