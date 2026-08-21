import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { logger } from '../observability/logger';
import { EVENT_QUEUE_ROUTING, QUEUE_NAMES, QueueName } from './event-routing';
import { REDIS_CONNECTION } from './redis.provider';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

/**
 * Polls `domain_event_outbox` for unpublished rows and relays each onto the
 * BullMQ queue(s) its event type routes to (ADR 0023). Runs on a fixed
 * interval rather than being purely webhook/emit-triggered, so publication
 * is guaranteed even if the process that wrote the outbox row crashes before
 * emitting anything — the same "don't only trust the trigger" principle
 * ADR 0004 applies to mailbox sync.
 */
@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private queues = new Map<QueueName, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    for (const name of QUEUE_NAMES) {
      this.queues.set(name, new Queue(name, { connection: this.redis }));
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async relay(): Promise<{ relayed: number; failed: number }> {
    const pending = await this.prisma.domainEventOutbox.findMany({
      where: { published: false, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let relayed = 0;
    let failed = 0;

    for (const row of pending) {
      const targets = EVENT_QUEUE_ROUTING[row.eventType];
      if (targets === undefined) {
        // Should be unreachable in CI (scripts/check-outbox-routing.js blocks
        // an unrouted event class from merging) but never silently drop a
        // real row in production if the check was bypassed.
        await this.markFailed(row.id, `No routing entry for event type "${row.eventType}"`);
        failed++;
        continue;
      }

      try {
        await Promise.all(
          targets.map((queueName) =>
            this.queues.get(queueName)!.add(
              row.eventType,
              { outboxEventId: row.id, tenantId: row.tenantId, eventType: row.eventType, payload: row.payload },
              // BullMQ disallows ":" in custom job IDs (it's a Redis key
              // delimiter internally) — "-" keeps the id deterministic
              // per (outbox row, target queue) for BullMQ's own dedup.
              { jobId: `${row.id}-${queueName}`, removeOnComplete: 1000, removeOnFail: 1000 },
            ),
          ),
        );
        await this.prisma.domainEventOutbox.update({
          where: { id: row.id },
          data: { published: true, publishedAt: new Date() },
        });
        relayed++;
      } catch (error) {
        await this.markFailed(row.id, error instanceof Error ? error.message : String(error));
        failed++;
      }
    }

    if (relayed > 0 || failed > 0) {
      logger.debug({ relayed, failed }, 'Outbox relay sweep complete');
    }
    return { relayed, failed };
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await this.prisma.domainEventOutbox.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: message.slice(0, 2000) },
    });
  }
}
