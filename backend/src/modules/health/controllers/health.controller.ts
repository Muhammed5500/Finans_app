import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Inject,
  Optional,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DbHealthIndicator } from '../indicators/db-health.indicator';
import { IngestionHealthIndicator } from '../indicators/ingestion-health.indicator';
import { RunTrackerService } from '../../jobs/services/run-tracker.service';
import { JobSchedulerService } from '../../jobs/services/job-scheduler.service';
import { CollectorJob } from '../../jobs/jobs.types';
import { MetricsService } from '../../../infrastructure/metrics';
import { PoliteHttpService } from '../../../infrastructure/http/polite-http.service';
import { CacheService } from '../../../infrastructure/cache';

/**
 * Health check response
 */
interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number };
    ingestion?: { status: string; lastRun?: string };
  };
}

/**
 * HealthController
 *
 * Health check and metrics endpoints for monitoring and Kubernetes probes.
 *
 * Endpoints:
 * - GET /health - Full health status with all indicators
 * - GET /health/live - Liveness probe (always returns 200 if process is running)
 * - GET /health/ready - Readiness probe (checks database connectivity)
 * - GET /health/collectors - Collector run status
 * - GET /health/collectors/:name - Single collector status
 * - GET /metrics - Application metrics (JSON or Prometheus format)
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly dbHealth: DbHealthIndicator,
    private readonly ingestionHealth: IngestionHealthIndicator,
    @Optional()
    @Inject(RunTrackerService)
    private readonly runTracker?: RunTrackerService,
    @Optional()
    @Inject(JobSchedulerService)
    private readonly jobScheduler?: JobSchedulerService,
    @Optional()
    @Inject(MetricsService)
    private readonly metrics?: MetricsService,
    @Optional()
    @Inject(PoliteHttpService)
    private readonly httpService?: PoliteHttpService,
    @Optional() @Inject(CacheService) private readonly cache?: CacheService,
  ) {}

  /**
   * GET /health
   *
   * Full health check with all indicators.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full health status' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  async getHealth(): Promise<HealthResponse> {
    const dbStatus = await this.dbHealth.check();
    const ingestionStatus = await this.ingestionHealth.check();

    const overall =
      dbStatus.status === 'ok' && ingestionStatus.status === 'ok'
        ? 'ok'
        : dbStatus.status === 'error'
          ? 'error'
          : 'degraded';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbStatus,
        ingestion: ingestionStatus,
      },
    };
  }

  /**
   * GET /health/live
   *
   * Liveness probe for Kubernetes.
   * Returns 200 if the process is running.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is running' })
  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/ready
   *
   * Readiness probe for Kubernetes.
   * Returns 200 if the service is ready to accept traffic.
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  async getReadiness() {
    const dbStatus = await this.dbHealth.check();

    if (dbStatus.status !== 'ok') {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        reason: 'Database not available',
      };
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/collectors
   *
   * Returns status of all collectors including last successful run time.
   */
  @Get('collectors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all collectors status' })
  @ApiResponse({ status: 200, description: 'Collector statuses' })
  async getCollectorsHealth() {
    if (!this.runTracker) {
      return {
        status: 'unavailable',
        message: 'Job scheduler not initialized',
        timestamp: new Date().toISOString(),
      };
    }

    const healthSummary = this.runTracker.getHealthSummary();
    const statuses = this.runTracker.getAllStatuses();

    const schedulerInfo = this.jobScheduler
      ? await this.jobScheduler.getSchedulerInfo()
      : { type: 'none', active: false };

    return {
      status: healthSummary.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      scheduler: schedulerInfo,
      collectors: statuses.map((s) => ({
        name: s.collector,
        healthy: healthSummary.collectors[s.collector]?.healthy ?? false,
        lastRunAt: s.lastRunAt,
        lastSuccessAt: s.lastSuccessAt,
        lastError: s.lastError,
        isRunning: s.isRunning,
        nextRunAt: s.nextRunAt,
        stats: s.stats,
      })),
    };
  }

  /**
   * GET /health/collectors/:name
   *
   * Returns status of a specific collector.
   */
  @Get('collectors/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get specific collector status' })
  @ApiResponse({ status: 200, description: 'Collector status' })
  getCollectorHealth(@Param('name') name: string) {
    if (!this.runTracker) {
      return {
        status: 'unavailable',
        message: 'Job scheduler not initialized',
        timestamp: new Date().toISOString(),
      };
    }

    // Map name to CollectorJob enum
    const jobMapping: Record<string, CollectorJob> = {
      gdelt: CollectorJob.GDELT,
      'sec-rss': CollectorJob.SEC_RSS,
      sec_rss: CollectorJob.SEC_RSS,
      kap: CollectorJob.KAP,
      'google-news': CollectorJob.GOOGLE_NEWS,
      google_news: CollectorJob.GOOGLE_NEWS,
    };

    const job = jobMapping[name.toLowerCase()];
    if (!job) {
      return {
        status: 'error',
        message: `Unknown collector: ${name}`,
        timestamp: new Date().toISOString(),
        validCollectors: Object.keys(jobMapping),
      };
    }

    const status = this.runTracker.getStatus(job);
    const healthSummary = this.runTracker.getHealthSummary();

    return {
      status: healthSummary.collectors[job]?.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      collector: {
        name: status.collector,
        healthy: healthSummary.collectors[job]?.healthy ?? false,
        lastRunAt: status.lastRunAt,
        lastSuccessAt: status.lastSuccessAt,
        lastError: status.lastError,
        isRunning: status.isRunning,
        nextRunAt: status.nextRunAt,
        stats: status.stats,
      },
    };
  }

  /**
   * GET /metrics
   *
   * Returns application metrics in JSON or Prometheus format.
   */
  @Get('/metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'prometheus'],
    description: 'Output format (default: json)',
  })
  @ApiResponse({ status: 200, description: 'Application metrics' })
  getMetrics(@Query('format') format?: string) {
    // Collect all metrics
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memoryUsage = process.memoryUsage();

    // Base metrics
    const baseMetrics = {
      uptime,
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    };

    // HTTP stats
    const httpStats = this.httpService?.getStats() ?? {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      retries: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Cache stats
    const cacheStats = this.cache?.getStats() ?? {
      hits: 0,
      misses: 0,
      size: 0,
    };

    // Collector stats
    const collectorStats: Record<string, any> = {};
    if (this.runTracker) {
      const statuses = this.runTracker.getAllStatuses();
      for (const status of statuses) {
        collectorStats[status.collector] = {
          totalRuns: status.stats.totalRuns,
          successfulRuns: status.stats.successfulRuns,
          failedRuns: status.stats.failedRuns,
          itemsCollected: status.stats.itemsCollected,
          lastSuccessAt: status.lastSuccessAt,
          isRunning: status.isRunning,
        };
      }
    }

    // Metrics service data
    const metricsData = this.metrics?.getMetrics();

    if (format === 'prometheus') {
      // Return Prometheus text format
      return this.formatPrometheus(
        baseMetrics,
        httpStats,
        cacheStats,
        collectorStats,
      );
    }

    // Return JSON format
    return {
      ...baseMetrics,
      http: httpStats,
      cache: cacheStats,
      collectors: collectorStats,
      ...(metricsData && { detailed: metricsData }),
    };
  }

  /**
   * Format metrics as Prometheus text exposition format
   */
  private formatPrometheus(
    base: any,
    http: any,
    cache: any,
    collectors: Record<string, any>,
  ): string {
    const lines: string[] = [];

    // Process metrics
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${base.uptime}`);
    lines.push('');

    lines.push('# HELP process_memory_heap_bytes Process memory heap in bytes');
    lines.push('# TYPE process_memory_heap_bytes gauge');
    lines.push(
      `process_memory_heap_bytes ${base.memory.heapUsed * 1024 * 1024}`,
    );
    lines.push('');

    lines.push('# HELP process_memory_rss_bytes Process memory RSS in bytes');
    lines.push('# TYPE process_memory_rss_bytes gauge');
    lines.push(`process_memory_rss_bytes ${base.memory.rss * 1024 * 1024}`);
    lines.push('');

    // HTTP metrics
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(
      `http_requests_total{status="success"} ${http.successfulRequests}`,
    );
    lines.push(`http_requests_total{status="failure"} ${http.failedRequests}`);
    lines.push(`http_requests_total{status="timeout"} ${http.timeouts}`);
    lines.push('');

    lines.push('# HELP http_retries_total Total HTTP retries');
    lines.push('# TYPE http_retries_total counter');
    lines.push(`http_retries_total ${http.retries}`);
    lines.push('');

    // Cache metrics
    lines.push('# HELP cache_operations_total Total cache operations');
    lines.push('# TYPE cache_operations_total counter');
    lines.push(`cache_operations_total{type="hit"} ${cache.hits}`);
    lines.push(`cache_operations_total{type="miss"} ${cache.misses}`);
    lines.push('');

    lines.push('# HELP cache_size_entries Current cache size');
    lines.push('# TYPE cache_size_entries gauge');
    lines.push(`cache_size_entries ${cache.size}`);
    lines.push('');

    // Collector metrics
    lines.push('# HELP collector_runs_total Total collector runs');
    lines.push('# TYPE collector_runs_total counter');
    for (const [name, stats] of Object.entries(collectors)) {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(
        `collector_runs_total{collector="${safeName}",status="success"} ${stats.successfulRuns}`,
      );
      lines.push(
        `collector_runs_total{collector="${safeName}",status="failure"} ${stats.failedRuns}`,
      );
    }
    lines.push('');

    lines.push('# HELP collector_items_total Total items collected');
    lines.push('# TYPE collector_items_total counter');
    for (const [name, stats] of Object.entries(collectors)) {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(
        `collector_items_total{collector="${safeName}"} ${stats.itemsCollected}`,
      );
    }
    lines.push('');

    lines.push('# HELP collector_running Current running collectors');
    lines.push('# TYPE collector_running gauge');
    for (const [name, stats] of Object.entries(collectors)) {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(
        `collector_running{collector="${safeName}"} ${stats.isRunning ? 1 : 0}`,
      );
    }
    lines.push('');

    return lines.join('\n');
  }
}
