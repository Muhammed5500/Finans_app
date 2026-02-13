import { Injectable } from '@nestjs/common';
import { CollectorJob, CollectorRunStatus, JobResult } from '../jobs.types';

/**
 * RunTrackerService
 *
 * Tracks collector run history and status.
 * Used by both BullMQ and cron-based schedulers.
 */
@Injectable()
export class RunTrackerService {
  private runStatus: Map<CollectorJob, CollectorRunStatus> = new Map();

  constructor() {
    // Initialize status for all collectors
    for (const job of Object.values(CollectorJob)) {
      this.runStatus.set(job, this.createInitialStatus(job));
    }
  }

  /**
   * Create initial status for a collector
   */
  private createInitialStatus(collector: CollectorJob): CollectorRunStatus {
    return {
      collector,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      isRunning: false,
      nextRunAt: null,
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        itemsCollected: 0,
      },
    };
  }

  /**
   * Mark collector as started
   */
  markStarted(collector: CollectorJob): void {
    const status = this.getStatus(collector);
    status.isRunning = true;
    status.lastRunAt = new Date();
  }

  /**
   * Mark collector as completed
   */
  markCompleted(collector: CollectorJob, result: JobResult): void {
    const status = this.getStatus(collector);
    status.isRunning = false;
    status.stats.totalRuns++;

    if (result.success) {
      status.lastSuccessAt = new Date();
      status.lastError = null;
      status.stats.successfulRuns++;
      if (result.itemsNew) {
        status.stats.itemsCollected += result.itemsNew;
      }
    } else {
      status.lastError = result.error || 'Unknown error';
      status.stats.failedRuns++;
    }
  }

  /**
   * Update next run time
   */
  setNextRunAt(collector: CollectorJob, nextRunAt: Date): void {
    const status = this.getStatus(collector);
    status.nextRunAt = nextRunAt;
  }

  /**
   * Get status for a collector
   */
  getStatus(collector: CollectorJob): CollectorRunStatus {
    let status = this.runStatus.get(collector);
    if (!status) {
      status = this.createInitialStatus(collector);
      this.runStatus.set(collector, status);
    }
    return status;
  }

  /**
   * Get status for all collectors
   */
  getAllStatuses(): CollectorRunStatus[] {
    return Array.from(this.runStatus.values());
  }

  /**
   * Get summary health status
   */
  getHealthSummary(): {
    healthy: boolean;
    collectors: Record<
      string,
      {
        healthy: boolean;
        lastSuccessAt: Date | null;
        lastError: string | null;
      }
    >;
  } {
    const collectors: Record<string, any> = {};
    let allHealthy = true;

    for (const [job, status] of this.runStatus.entries()) {
      // Consider unhealthy if no success in last 30 minutes and has run at least once
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const isHealthy =
        status.stats.totalRuns === 0 ||
        (status.lastSuccessAt !== null &&
          status.lastSuccessAt > thirtyMinutesAgo);

      if (!isHealthy) {
        allHealthy = false;
      }

      collectors[job] = {
        healthy: isHealthy,
        lastSuccessAt: status.lastSuccessAt,
        lastError: status.lastError,
      };
    }

    return {
      healthy: allHealthy,
      collectors,
    };
  }

  /**
   * Reset stats for a collector
   */
  resetStats(collector: CollectorJob): void {
    const status = this.getStatus(collector);
    status.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      itemsCollected: 0,
    };
  }

  /**
   * Reset all stats
   */
  resetAllStats(): void {
    for (const job of Object.values(CollectorJob)) {
      this.resetStats(job);
    }
  }
}
