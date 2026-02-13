import { Module } from '@nestjs/common';
import { TickersController } from './controllers/tickers.controller';
import { TickersService } from './services/tickers.service';
import { TickerExtractorService } from './services/ticker-extractor.service';
import { TickerNormalizerService } from './services/ticker-normalizer.service';
import { TickersRepository } from './repositories/tickers.repository';

/**
 * TickersModule
 *
 * Handles ticker/tag extraction and management.
 *
 * Features:
 * - Extract ticker symbols from news text
 * - Normalize symbols across markets (BIST, NYSE, NASDAQ, etc.)
 * - Match against known ticker list
 * - Associate tickers with news items
 * - API endpoints for ticker queries
 */
@Module({
  controllers: [TickersController],
  providers: [
    TickersService,
    TickerExtractorService,
    TickerNormalizerService,
    TickersRepository,
  ],
  exports: [
    TickersService,
    TickerExtractorService,
    TickerNormalizerService,
    TickersRepository,
  ],
})
export class TickersModule {}
