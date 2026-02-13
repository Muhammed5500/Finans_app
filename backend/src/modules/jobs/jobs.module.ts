import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RunTrackerService } from './services/run-tracker.service';
import { CollectorExecutorService } from './services/collector-executor.service';
import { CronSchedulerService } from './services/cron-scheduler.service';
import { BullMQSchedulerService } from './services/bullmq-scheduler.service';
import { JobSchedulerService } from './services/job-scheduler.service';
import { IngestionModule } from '../ingestion/ingestion.module';

/**
 * JobsModule
 *
 * Handles job scheduling for all collectors.
 *
 * Features:
 * - BullMQ for Redis-based queuing (USE_REDIS_QUEUE=true)
 * - Cron-based fallback (USE_REDIS_QUEUE=false)
 * - Run tracking and statistics
 * - Manual job triggering
 */
@Module({
  imports: [ScheduleModule.forRoot(), IngestionModule],
  providers: [
    RunTrackerService,
    CollectorExecutorService,
    CronSchedulerService,
    BullMQSchedulerService,
    JobSchedulerService,
  ],
  exports: [JobSchedulerService, RunTrackerService],
})
export class JobsModule {}
