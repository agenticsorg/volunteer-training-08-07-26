import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventBridgeWorker } from './event-bridge.worker';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { RedisConnectionService, RedisProvider } from './redis.provider';

@Module({
  imports: [DatabaseModule],
  providers: [RedisConnectionService, RedisProvider, OutboxRelayWorker, EventBridgeWorker],
  exports: [RedisProvider],
})
export class QueueModule {}
