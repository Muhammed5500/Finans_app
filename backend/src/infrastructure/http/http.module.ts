import { Global, Module } from '@nestjs/common';
import { PoliteHttpService } from './polite-http.service';

@Global()
@Module({
  providers: [PoliteHttpService],
  exports: [PoliteHttpService],
})
export class HttpModule {}
