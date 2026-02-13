import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollectorJob } from '../jobs.types';
import { CronSchedulerService } from './cron-scheduler.service';
import { BullMQSchedulerService } from './bullmq-scheduler.service';
import { RunTrackerService } from './run-tracker.service';

/**
 * JobSchedulerService
 *
 * Unified interface for job scheduling.
 * Delegates to either BullMQ or Cron scheduler based on configuration.
 */
@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly useRedis: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cronScheduler: CronSchedulerService,
    private readonly bullmqScheduler: BullMQSchedulerService,
    private readonly runTracker: RunTrackerService,
  ) {
    this.useRedis =
      this.configService.get<string>('USE_REDIS_QUEUE', 'false') === 'true';
  }

  /**
   * Get the active scheduler type
   */
  getSchedulerType(): 'bullmq' | 'cron' | 'none' {
    if (this.useRedis && this.bullmqScheduler.isSchedulerActive()) {
      return 'bullmq';
    }
    if (!this.useRedis && this.cronScheduler.isSchedulerActive()) {
      return 'cron';
    }
    return 'none';
  }

  /**
   * Check if scheduler is active
   */
  isActive(): boolean {
    return this.getSchedulerType() !== 'none';
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(job: CollectorJob): Promise<void> {
    if (this.useRedis && this.bullmqScheduler.isSchedulerActive()) {
      await this.bullmqScheduler.triggerJob(job);
    } else if (this.cronScheduler.isSchedulerActive()) {
      await this.cronScheduler.triggerJob(job);
    } else {
      throw new Error('No active scheduler');
    }
  }

  /**
   * Get all collector statuses
   */
  getCollectorStatuses() {
    return this.runTracker.getAllStatuses();
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    return this.runTracker.getHealthSummary();
  }

  /**
   * Get scheduler info
   */
  async getSchedulerInfo(): Promise<{
    type: string;
    active: boolean;
    useRedis: boolean;
    queueStats?: any;
  }> {
    const info: any = {
      type: this.getSchedulerType(),
      active: this.isActive(),
      useRedis: this.useRedis,
    };

    if (this.useRedis && this.bullmqScheduler.isSchedulerActive()) {
      info.queueStats = await this.bullmqScheduler.getQueueStats();
    }

    return info;
  }
}
