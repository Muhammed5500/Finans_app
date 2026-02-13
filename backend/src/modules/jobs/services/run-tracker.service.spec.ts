import { Test, TestingModule } from '@nestjs/testing';
import { RunTrackerService } from './run-tracker.service';
import { CollectorJob, JobResult } from '../jobs.types';

describe('RunTrackerService', () => {
  let service: RunTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RunTrackerService],
    }).compile();

    service = module.get<RunTrackerService>(RunTrackerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize status for all collectors', () => {
      const statuses = service.getAllStatuses();
      expect(statuses.length).toBe(Object.values(CollectorJob).length);
    });

    it('should have default values for each collector', () => {
      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.collector).toBe(CollectorJob.GDELT);
      expect(status.lastRunAt).toBeNull();
      expect(status.lastSuccessAt).toBeNull();
      expect(status.lastError).toBeNull();
      expect(status.isRunning).toBe(false);
      expect(status.nextRunAt).toBeNull();
      expect(status.stats.totalRuns).toBe(0);
      expect(status.stats.successfulRuns).toBe(0);
      expect(status.stats.failedRuns).toBe(0);
      expect(status.stats.itemsCollected).toBe(0);
    });
  });

  describe('markStarted', () => {
    it('should mark collector as running', () => {
      service.markStarted(CollectorJob.GDELT);
      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.isRunning).toBe(true);
      expect(status.lastRunAt).toBeInstanceOf(Date);
    });
  });

  describe('markCompleted', () => {
    it('should mark successful completion', () => {
      service.markStarted(CollectorJob.GDELT);

      const result: JobResult = {
        success: true,
        itemsFound: 50,
        itemsNew: 10,
        duration: 1000,
      };

      service.markCompleted(CollectorJob.GDELT, result);

      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.isRunning).toBe(false);
      expect(status.lastSuccessAt).toBeInstanceOf(Date);
      expect(status.lastError).toBeNull();
      expect(status.stats.totalRuns).toBe(1);
      expect(status.stats.successfulRuns).toBe(1);
      expect(status.stats.failedRuns).toBe(0);
      expect(status.stats.itemsCollected).toBe(10);
    });

    it('should mark failed completion', () => {
      service.markStarted(CollectorJob.GDELT);

      const result: JobResult = {
        success: false,
        error: 'Connection timeout',
        duration: 5000,
      };

      service.markCompleted(CollectorJob.GDELT, result);

      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.isRunning).toBe(false);
      expect(status.lastError).toBe('Connection timeout');
      expect(status.stats.totalRuns).toBe(1);
      expect(status.stats.successfulRuns).toBe(0);
      expect(status.stats.failedRuns).toBe(1);
    });

    it('should accumulate items collected', () => {
      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 10,
      });

      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 20,
      });

      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.stats.itemsCollected).toBe(30);
    });
  });

  describe('setNextRunAt', () => {
    it('should set next run time', () => {
      const nextRun = new Date(Date.now() + 180000);
      service.setNextRunAt(CollectorJob.GDELT, nextRun);

      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.nextRunAt).toEqual(nextRun);
    });
  });

  describe('getHealthSummary', () => {
    it('should return healthy when no runs yet', () => {
      const summary = service.getHealthSummary();
      expect(summary.healthy).toBe(true);
    });

    it('should return healthy when recent success', () => {
      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 10,
      });

      const summary = service.getHealthSummary();
      expect(summary.healthy).toBe(true);
      expect(summary.collectors[CollectorJob.GDELT].healthy).toBe(true);
    });

    it('should return unhealthy when last run failed long ago', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 10,
      });

      // Advance time by 31 minutes
      jest.setSystemTime(now + 31 * 60 * 1000);

      const summary = service.getHealthSummary();
      expect(summary.collectors[CollectorJob.GDELT].healthy).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset stats for a collector', () => {
      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 10,
      });

      service.resetStats(CollectorJob.GDELT);

      const status = service.getStatus(CollectorJob.GDELT);
      expect(status.stats.totalRuns).toBe(0);
      expect(status.stats.successfulRuns).toBe(0);
      expect(status.stats.itemsCollected).toBe(0);
    });
  });

  describe('resetAllStats', () => {
    it('should reset stats for all collectors', () => {
      service.markStarted(CollectorJob.GDELT);
      service.markCompleted(CollectorJob.GDELT, {
        success: true,
        itemsNew: 10,
      });

      service.markStarted(CollectorJob.SEC_RSS);
      service.markCompleted(CollectorJob.SEC_RSS, {
        success: true,
        itemsNew: 5,
      });

      service.resetAllStats();

      const statuses = service.getAllStatuses();
      for (const status of statuses) {
        expect(status.stats.totalRuns).toBe(0);
      }
    });
  });
});
