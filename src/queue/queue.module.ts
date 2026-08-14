import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '../observability/logger';

@Module({})
export class QueueModule {
  constructor(private configService: ConfigService) {
    logger.info({ redis_url: this.configService.get('REDIS_URL') }, 'Queue module initialized (BullMQ skeleton)');
  }
}
