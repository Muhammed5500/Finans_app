import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

// Infrastructure
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HttpModule } from './infrastructure/http/http.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';

// Feature Modules
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { NewsModule } from './modules/news/news.module';
import { TickersModule } from './modules/tickers/tickers.module';
import { TagsModule } from './modules/tags/tags.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';

// Config
import { validateEnv } from './config/env.validation';

/**
 * AppModule
 *
 * Root application module that imports all feature modules.
 *
 * Module Structure:
 * - IngestionModule: Data collectors (GDELT, SEC RSS, KAP, Google News)
 * - NewsModule: News storage and query API
 * - TickersModule: Ticker extraction and management
 * - HealthModule: Health check endpoints
 *
 * Infrastructure:
 * - PrismaModule: PostgreSQL database access
 * - HttpModule: Polite HTTP client with rate limiting
 */
@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      validate: validateEnv,
    }),

    // Structured logging
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
      },
    }),

    // Per-IP rate limiting for public endpoints
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 120, // 120 requests per minute
      },
    ]),

    // Cron job scheduling
    ScheduleModule.forRoot(),

    // Infrastructure modules
    PrismaModule,
    HttpModule,
    CacheModule,
    MetricsModule,

    // Feature modules
    IngestionModule,
    NewsModule,
    TickersModule,
    TagsModule,
    HealthModule,
    JobsModule,
  ],
})
export class AppModule {}
