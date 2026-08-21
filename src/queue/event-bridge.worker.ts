import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../observability/logger';
import { QUEUE_NAMES } from './event-routing';
import { getQueuePrefix } from './queue-prefix';
import { REDIS_CONNECTION } from './redis.provider';

interface RelayedJobData {
  outboxEventId: string;
  tenantId: string;
  eventType: string;
  payload: unknown;
}

/**
 * One BullMQ Worker per consuming-context queue. Bridges durable,
 * cross-process delivery (outbox -> BullMQ, ADR 0023) back into the
 * in-process `EventEmitter2` bus that bounded-context application-layer
 * `@OnEvent` consumers subscribe to (ADR 0024) — BullMQ is what survives a
 * crash and guarantees at-least-once delivery; EventEmitter2 is purely the
 * local fan-out once a job has safely landed in this process. Consumers are
 * responsible for their own idempotency against `EventConsumerCheckpoint`
 * keyed on `(outboxEventId, consumerName)`, since a redelivered job re-emits
 * here exactly the same way a first delivery does.
 */
@Injectable()
export class EventBridgeWorker implements OnModuleInit, OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    const prefix = getQueuePrefix();
    this.workers = QUEUE_NAMES.map(
      (queueName) =>
        new Worker(
          queueName,
          async (job: Job<RelayedJobData>) => {
            await this.eventEmitter.emitAsync(job.data.eventType, {
              ...(job.data.payload as object),
              outboxEventId: job.data.outboxEventId,
              tenantId: job.data.tenantId,
            });
          },
          { connection: this.redis, prefix },
        ),
    );
    for (const worker of this.workers) {
      worker.on('failed', (job, err) => {
        logger.error({ queue: worker.name, jobId: job?.id, err: err.message }, 'Event bridge job failed');
      });
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
