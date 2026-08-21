import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

export const RedisProvider: Provider = {
  provide: REDIS_CONNECTION,
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    // maxRetriesPerRequest: null is required by BullMQ's blocking connections
    // (both the Queue producer and any Worker sharing this connection).
    return new Redis(url, { maxRetriesPerRequest: null });
  },
  inject: [ConfigService],
};
