import { Injectable, OnModuleDestroy, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

/**
 * A plain `useFactory` provider has no destroy lifecycle hook in Nest — the
 * ioredis connection it created would otherwise never be closed on app
 * shutdown, leaving an open TCP connection (and its retry timers) that
 * prevents the process from ever exiting naturally. Owning the connection in
 * an OnModuleDestroy-implementing class fixes that; `.quit()` (not
 * `.disconnect()`) waits for in-flight commands — including whatever the
 * BullMQ Queue/Worker instances built on top of this shared connection are
 * still finishing in their own onModuleDestroy — before closing.
 */
@Injectable()
export class RedisConnectionService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    // maxRetriesPerRequest: null is required by BullMQ's blocking connections
    // (both the Queue producer and any Worker sharing this connection).
    this.client = new Redis(url, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

export const RedisProvider: Provider = {
  provide: REDIS_CONNECTION,
  useFactory: (service: RedisConnectionService) => service.client,
  inject: [RedisConnectionService],
};
