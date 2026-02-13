import { Module } from '@nestjs/common';
import { TaggingService } from './tagging.service';

/**
 * TaggingModule
 *
 * Provides ticker and tag extraction services.
 */
@Module({
  providers: [TaggingService],
  exports: [TaggingService],
})
export class TaggingModule {}
