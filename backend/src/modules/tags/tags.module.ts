import { Module } from '@nestjs/common';
import { TagsController } from './controllers/tags.controller';
import { TagsService } from './services/tags.service';
import { TagsRepository } from './repositories/tags.repository';

/**
 * TagsModule
 *
 * Handles tag storage and API endpoints.
 */
@Module({
  controllers: [TagsController],
  providers: [TagsService, TagsRepository],
  exports: [TagsService, TagsRepository],
})
export class TagsModule {}
