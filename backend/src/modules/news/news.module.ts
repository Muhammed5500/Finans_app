import { Module } from '@nestjs/common';
import { NewsController } from './controllers/news.controller';
import { AdminNewsController } from './controllers/admin-news.controller';
import { NewsQueryService } from './services/news-query.service';
import { NewsIngestService } from './services/news-ingest.service';
import { NewsRepository } from './repositories/news.repository';
import { TaggingModule } from '../../shared/tagging';

/**
 * NewsModule
 *
 * Handles news storage, querying, and API endpoints.
 *
 * Features:
 * - Paginated news listing
 * - Full-text search
 * - Filter by source, ticker, date range
 * - Admin endpoints for management
 * - News ingestion with deduplication
 */
@Module({
  imports: [TaggingModule],
  controllers: [NewsController, AdminNewsController],
  providers: [NewsQueryService, NewsIngestService, NewsRepository],
  exports: [NewsQueryService, NewsIngestService, NewsRepository],
})
export class NewsModule {}
