/**
 * Job Scheduling Types
 */

/**
 * Collector job names
 */
export enum CollectorJob {
  GDELT = 'collector:gdelt',
  SEC_RSS = 'collector:sec-rss',
  KAP = 'collector:kap',
  GOOGLE_NEWS = 'collector:google-news',
}

/**
 * Job intervals in milliseconds
 */
export const COLLECTOR_INTERVALS: Record<CollectorJob, number> = {
  [CollectorJob.GDELT]: 3 * 60 * 1000, // 3 minutes
  [CollectorJob.KAP]: 3 * 60 * 1000, // 3 minutes
  [CollectorJob.GOOGLE_NEWS]: 10 * 60 * 1000, // 10 minutes
  [CollectorJob.SEC_RSS]: 15 * 60 * 1000, // 15 minutes
};

/**
 * Cron expressions for each collector
 */
export const COLLECTOR_CRON: Record<CollectorJob, string> = {
  [CollectorJob.GDELT]: '0 */3 * * * *', // Every 3 minutes
  [CollectorJob.KAP]: '30 */3 * * * *', // Every 3 minutes (offset by 30s)
  [CollectorJob.GOOGLE_NEWS]: '0 */10 * * * *', // Every 10 minutes
  [CollectorJob.SEC_RSS]: '0 */15 * * * *', // Every 15 minutes
};

/**
 * Job execution result
 */
export interface JobResult {
  success: boolean;
  itemsFound?: number;
  itemsNew?: number;
  duration?: number;
  error?: string;
}

/**
 * Collector run status
 */
export interface CollectorRunStatus {
  collector: string;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  isRunning: boolean;
  nextRunAt: Date | null;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    itemsCollected: number;
  };
}

/**
 * Job scheduler configuration
 */
export interface JobSchedulerConfig {
  useRedisQueue: boolean;
  redisUrl?: string;
  enabledCollectors: CollectorJob[];
}
