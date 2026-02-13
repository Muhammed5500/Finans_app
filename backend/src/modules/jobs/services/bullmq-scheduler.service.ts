import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollectorJob, COLLECTOR_INTERVALS } from '../jobs.types';
import { CollectorExecutorService } from './collector-executor.service';
import { RunTrackerService } from './run-tracker.service';

// Conditional import - BullMQ may not be installed
let Queue: any;
let Worker: any;
let QueueScheduler: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bullmq = require('bullmq');
  Queue = bullmq.Queue;
  Worker = bullmq.Worker;
  QueueScheduler = bullmq.QueueScheduler;
} catch {
  // BullMQ not available
}

/**
 * BullMQSchedulerService
 *
 * Redis-based job scheduler using BullMQ.
 * Used when Redis is available (USE_REDIS_QUEUE=true).
 *
 * Features:
 * - Repeatable jobs with configurable intervals
 * - Automatic retry on failure
 * - Job persistence across restarts
 * - Distributed execution support
 */
@Injectable()
export class BullMQSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQSchedulerService.name);
  private queue: any;
  private worker: any;
  private scheduler: any;
  private isActive = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly executor: CollectorExecutorService,
    private readonly runTracker: RunTrackerService,
  ) {}

  async onModuleInit() {
    const useRedis =
      this.configService.get<string>('USE_REDIS_QUEUE', 'false') === 'true';

    if (!useRedis) {
      this.logger.log('BullMQ scheduler disabled (USE_REDIS_QUEUE=false)');
      return;
    }

    if (!Queue || !Worker) {
      this.logger.error(
        'BullMQ not available. Install with: npm install bullmq',
      );
      return;
    }

    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    try {
      await this.setupQueue(redisUrl);
      await this.setupWorker(redisUrl);
      await this.setupScheduler(redisUrl);
      await this.scheduleJobs();

      this.isActive = true;
      this.logger.log('BullMQ scheduler initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize BullMQ: ${error}`);
    }
  }

  async onModuleDestroy() {
    if (this.isActive) {
      await this.shutdown();
    }
  }

  /**
   * Setup the job queue
   */
  private async setupQueue(redisUrl: string): Promise<void> {
    const connection = this.parseRedisUrl(redisUrl);

    this.queue = new Queue('collectors', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs
        },
      },
    });

    this.logger.debug('Queue created');
  }

  /**
   * Setup the worker to process jobs
   */
  private async setupWorker(redisUrl: string): Promise<void> {
    const connection = this.parseRedisUrl(redisUrl);

    this.worker = new Worker(
      'collectors',
      async (job: any) => {
        const collectorJob = job.name as CollectorJob;
        return await this.executor.execute(collectorJob);
      },
      {
        connection,
        concurrency: 1, // Process one job at a time
      },
    );

    this.worker.on('completed', (job: any, _result: any) => {
      this.logger.debug(`Job ${job.name} completed`);
      this.updateNextRunTime(job.name as CollectorJob);
    });

    this.worker.on('failed', (job: any, error: Error) => {
      this.logger.error(`Job ${job?.name} failed: ${error.message}`);
    });

    this.logger.debug('Worker created');
  }

  /**
   * Setup the scheduler for repeatable jobs
   */
  private async setupScheduler(redisUrl: string): Promise<void> {
    if (!QueueScheduler) {
      // QueueScheduler is deprecated in newer BullMQ versions
      return;
    }

    const connection = this.parseRedisUrl(redisUrl);

    this.scheduler = new QueueScheduler('collectors', { connection });
    this.logger.debug('Scheduler created');
  }

  /**
   * Schedule repeatable jobs for all enabled collectors
   */
  private async scheduleJobs(): Promise<void> {
    const enabledCollectors = this.executor.getEnabledCollectors();

    // Remove existing repeatable jobs first
    const existingJobs = await this.queue.getRepeatableJobs();
    for (const job of existingJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Schedule each enabled collector
    for (const job of enabledCollectors) {
      await this.scheduleJob(job);
    }

    this.logger.log(
      `BullMQ scheduler ready with ${enabledCollectors.length} collectors: ${enabledCollectors.join(', ')}`,
    );
  }

  /**
   * Schedule a single repeatable job
   */
  private async scheduleJob(collectorJob: CollectorJob): Promise<void> {
    const interval = COLLECTOR_INTERVALS[collectorJob];

    await this.queue.add(
      collectorJob,
      { collector: collectorJob },
      {
        repeat: {
          every: interval,
        },
        jobId: collectorJob, // Prevent duplicates
      },
    );

    // Set initial next run time
    this.runTracker.setNextRunAt(collectorJob, new Date(Date.now() + interval));

    this.logger.log(
      `Scheduled ${collectorJob} to run every ${interval / 1000}s`,
    );
  }

  /**
   * Update next run time after job completion
   */
  private updateNextRunTime(job: CollectorJob): void {
    const interval = COLLECTOR_INTERVALS[job];
    this.runTracker.setNextRunAt(job, new Date(Date.now() + interval));
  }

  /**
   * Parse Redis URL to connection object
   */
  private parseRedisUrl(url: string): {
    host: string;
    port: number;
    password?: string;
  } {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || undefined,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(job: CollectorJob): Promise<void> {
    if (!this.isActive) {
      throw new Error('BullMQ scheduler not active');
    }

    this.logger.log(`Manually triggering job: ${job}`);
    await this.queue.add(job, { collector: job, manual: true });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Shutdown the scheduler
   */
  private async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.scheduler) {
      await this.scheduler.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    this.logger.log('BullMQ scheduler shutdown complete');
  }

  /**
   * Check if BullMQ scheduler is active
   */
  isSchedulerActive(): boolean {
    return this.isActive;
  }

  /**
   * Get scheduler type
   */
  getSchedulerType(): string {
    return 'bullmq';
  }
}
