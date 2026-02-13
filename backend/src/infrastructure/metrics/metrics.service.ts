import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Counter metric
 */
export interface Counter {
  value: number;
  labels: Record<string, string>;
}

/**
 * Gauge metric
 */
export interface Gauge {
  value: number;
  labels: Record<string, string>;
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

/**
 * Histogram metric
 */
export interface Histogram {
  sum: number;
  count: number;
  buckets: HistogramBucket[];
  labels: Record<string, string>;
}

/**
 * MetricsService
 *
 * Simple in-memory metrics collection.
 * Compatible with Prometheus exposition format but no dependency required.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  private readonly histograms = new Map<string, Histogram>();
  private readonly startTime = Date.now();

  // Default histogram buckets (in seconds)
  private readonly defaultBuckets = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
  ];

  async onModuleInit() {
    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // HTTP request counters
    this.createCounter('http_requests_total', { status: '2xx' });
    this.createCounter('http_requests_total', { status: '4xx' });
    this.createCounter('http_requests_total', { status: '5xx' });

    // Collector metrics
    for (const collector of ['gdelt', 'sec_rss', 'kap', 'google_news']) {
      this.createCounter('collector_runs_total', {
        collector,
        status: 'success',
      });
      this.createCounter('collector_runs_total', {
        collector,
        status: 'failure',
      });
      this.createCounter('collector_items_total', { collector });
      this.createGauge('collector_last_run_timestamp', { collector });
      this.createGauge('collector_circuit_state', { collector });
    }

    // Ingestion metrics
    this.createCounter('news_items_ingested_total', {});
    this.createCounter('news_items_duplicates_total', {});

    // Cache metrics
    this.createCounter('cache_hits_total', {});
    this.createCounter('cache_misses_total', {});
    this.createGauge('cache_size', {});
  }

  /**
   * Create or get a counter
   */
  private createCounter(name: string, labels: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    if (!this.counters.has(key)) {
      this.counters.set(key, { value: 0, labels });
    }
  }

  /**
   * Create or get a gauge
   */
  private createGauge(name: string, labels: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    if (!this.gauges.has(key)) {
      this.gauges.set(key, { value: 0, labels });
    }
  }

  /**
   * Increment a counter
   */
  incCounter(
    name: string,
    labels: Record<string, string> = {},
    value = 1,
  ): void {
    const key = this.makeKey(name, labels);
    let counter = this.counters.get(key);

    if (!counter) {
      counter = { value: 0, labels };
      this.counters.set(key, counter);
    }

    counter.value += value;
  }

  /**
   * Set a gauge value
   */
  setGauge(
    name: string,
    labels: Record<string, string> = {},
    value: number,
  ): void {
    const key = this.makeKey(name, labels);
    let gauge = this.gauges.get(key);

    if (!gauge) {
      gauge = { value: 0, labels };
      this.gauges.set(key, gauge);
    }

    gauge.value = value;
  }

  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.makeKey(name, labels);
    let gauge = this.gauges.get(key);

    if (!gauge) {
      gauge = { value: 0, labels };
      this.gauges.set(key, gauge);
    }

    gauge.value += value;
  }

  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: Record<string, string> = {}, value = 1): void {
    this.incGauge(name, labels, -value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(
    name: string,
    labels: Record<string, string> = {},
    value: number,
    buckets = this.defaultBuckets,
  ): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        sum: 0,
        count: 0,
        buckets: buckets.map((le) => ({ le, count: 0 })),
        labels,
      };
      this.histograms.set(key, histogram);
    }

    histogram.sum += value;
    histogram.count++;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Time a function and record duration
   */
  async timeAsync<T>(
    name: string,
    labels: Record<string, string>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      this.observeHistogram(name, labels, duration);
    }
  }

  /**
   * Get all metrics as JSON
   */
  getMetrics(): {
    counters: Record<string, { value: number; labels: Record<string, string> }>;
    gauges: Record<string, { value: number; labels: Record<string, string> }>;
    histograms: Record<
      string,
      {
        sum: number;
        count: number;
        buckets: HistogramBucket[];
        labels: Record<string, string>;
      }
    >;
    uptime: number;
    timestamp: string;
  } {
    const counters: Record<
      string,
      { value: number; labels: Record<string, string> }
    > = {};
    const gauges: Record<
      string,
      { value: number; labels: Record<string, string> }
    > = {};
    const histograms: Record<string, any> = {};

    for (const [key, counter] of this.counters) {
      counters[key] = { value: counter.value, labels: counter.labels };
    }

    for (const [key, gauge] of this.gauges) {
      gauges[key] = { value: gauge.value, labels: gauge.labels };
    }

    for (const [key, histogram] of this.histograms) {
      histograms[key] = {
        sum: histogram.sum,
        count: histogram.count,
        avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        buckets: histogram.buckets,
        labels: histogram.labels,
      };
    }

    return {
      counters,
      gauges,
      histograms,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get metrics in Prometheus text format
   */
  getPrometheusFormat(): string {
    const lines: string[] = [];

    // Add uptime
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(
      `process_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`,
    );
    lines.push('');

    // Group counters by name
    const countersByName = new Map<string, Counter[]>();
    for (const [key, counter] of this.counters) {
      const name = key.split('{')[0];
      if (!countersByName.has(name)) {
        countersByName.set(name, []);
      }
      countersByName.get(name)!.push(counter);
    }

    for (const [name, counters] of countersByName) {
      lines.push(`# TYPE ${name} counter`);
      for (const counter of counters) {
        const labelsStr = this.formatLabels(counter.labels);
        lines.push(`${name}${labelsStr} ${counter.value}`);
      }
      lines.push('');
    }

    // Group gauges by name
    const gaugesByName = new Map<string, Gauge[]>();
    for (const [key, gauge] of this.gauges) {
      const name = key.split('{')[0];
      if (!gaugesByName.has(name)) {
        gaugesByName.set(name, []);
      }
      gaugesByName.get(name)!.push(gauge);
    }

    for (const [name, gauges] of gaugesByName) {
      lines.push(`# TYPE ${name} gauge`);
      for (const gauge of gauges) {
        const labelsStr = this.formatLabels(gauge.labels);
        lines.push(`${name}${labelsStr} ${gauge.value}`);
      }
      lines.push('');
    }

    // Histograms
    for (const [key, histogram] of this.histograms) {
      const name = key.split('{')[0];
      const labelsStr = this.formatLabels(histogram.labels);

      lines.push(`# TYPE ${name} histogram`);
      for (const bucket of histogram.buckets) {
        const bucketLabels = { ...histogram.labels, le: String(bucket.le) };
        lines.push(
          `${name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count}`,
        );
      }
      lines.push(`${name}_sum${labelsStr} ${histogram.sum}`);
      lines.push(`${name}_count${labelsStr} ${histogram.count}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Make a unique key for a metric with labels
   */
  private makeKey(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((k) => `${k}="${labels[k]}"`)
      .join(',');
    return sortedLabels ? `${name}{${sortedLabels}}` : name;
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.value = 0;
    }
    for (const gauge of this.gauges.values()) {
      gauge.value = 0;
    }
    for (const histogram of this.histograms.values()) {
      histogram.sum = 0;
      histogram.count = 0;
      for (const bucket of histogram.buckets) {
        bucket.count = 0;
      }
    }
  }
}
