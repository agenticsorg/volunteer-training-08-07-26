import { Module } from '@nestjs/common';
import { SLIService } from './sli.service';

@Module({
  providers: [SLIService],
  exports: [SLIService],
})
export class ObservabilityModule {}
