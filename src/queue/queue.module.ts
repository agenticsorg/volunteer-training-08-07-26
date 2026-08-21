import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EventBridgeWorker } from './event-bridge.worker';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { RedisProvider } from './redis.provider';

@Module({
  imports: [DatabaseModule],
  providers: [RedisProvider, OutboxRelayWorker, EventBridgeWorker],
  exports: [RedisProvider],
})
export class QueueModule {}
