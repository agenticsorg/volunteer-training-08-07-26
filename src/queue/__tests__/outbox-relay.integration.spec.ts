import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { EventBridgeWorker } from '../event-bridge.worker';
import { OutboxRelayWorker } from '../outbox-relay.worker';

const skipIfNoInfra = process.env.DATABASE_URL && process.env.REDIS_URL ? describe : describe.skip;

/**
 * End-to-end proof that the durable event backbone (ADR 0023) actually
 * delivers: a domain_event_outbox row -> outbox-relay sweep -> real BullMQ
 * queue -> event-bridge Worker -> in-process EventEmitter2 emit. This is
 * the "Done when" criterion for ADR 0023 — the first real evidence, outside
 * unit tests, that a message can flow through this pipeline at all.
 */
skipIfNoInfra('Outbox relay -> BullMQ -> EventEmitter2 bridge (integration)', () => {
  let prisma: PrismaService;
  let redis: Redis;
  let eventEmitter: EventEmitter2;
  let relayWorker: OutboxRelayWorker;
  let bridgeWorker: EventBridgeWorker;
  let tenantId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    redis = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
    eventEmitter = new EventEmitter2();

    relayWorker = new OutboxRelayWorker(prisma, redis);
    relayWorker.onModuleInit();

    bridgeWorker = new EventBridgeWorker(redis, eventEmitter);
    bridgeWorker.onModuleInit();

    const tenant = await prisma.tenant.create({ data: { name: 'Outbox Relay Integration Test Tenant' } });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await relayWorker.onModuleDestroy();
    await bridgeWorker.onModuleDestroy();
    await prisma.domainEventOutbox.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.onModuleDestroy();
    redis.disconnect();
  });

  it(
    'relays a MessageIngestedEvent outbox row to its routed consumer queues and emits it in-process',
    async () => {
      const messageId = crypto.randomUUID();

      const received = new Promise((resolve) => {
        eventEmitter.once('MessageIngestedEvent', resolve);
      });

      const row = await prisma.domainEventOutbox.create({
        data: {
          tenantId,
          aggregateId: messageId,
          aggregateType: 'IngestedMessage',
          eventType: 'MessageIngestedEvent',
          payload: { messageId, tenantId, mailboxId: 'user@example.com', platform: 'gmail' },
        },
      });
      expect(row.published).toBe(false);

      const { relayed, failed } = await relayWorker.relay();
      expect(failed).toBe(0);
      expect(relayed).toBeGreaterThanOrEqual(1);

      const afterRelay = await prisma.domainEventOutbox.findUnique({ where: { id: row.id } });
      expect(afterRelay?.published).toBe(true);

      // MessageIngestedEvent routes to classification, threat-detection, and
      // contact-graph (src/queue/event-routing.ts) — the bridge Worker for
      // whichever of those processes the job first re-emits it in-process.
      const payload: any = await received;
      expect(payload.messageId).toBe(messageId);
      expect(payload.outboxEventId).toBe(row.id);
    },
    15000,
  );

  it(
    'does not mark an outbox row published a second time on a redundant relay sweep',
    async () => {
      const messageId = crypto.randomUUID();
      const row = await prisma.domainEventOutbox.create({
        data: {
          tenantId,
          aggregateId: messageId,
          aggregateType: 'IngestedMessage',
          eventType: 'MessageIngestedEvent',
          payload: { messageId, tenantId, mailboxId: 'user2@example.com', platform: 'gmail' },
        },
      });

      await relayWorker.relay();
      const firstPublishedAt = (await prisma.domainEventOutbox.findUnique({ where: { id: row.id } }))?.publishedAt;

      const { relayed } = await relayWorker.relay();
      // Already-published rows are excluded from the next sweep's query, so
      // this second call should not touch this row again.
      const secondPublishedAt = (await prisma.domainEventOutbox.findUnique({ where: { id: row.id } }))?.publishedAt;

      expect(secondPublishedAt?.getTime()).toBe(firstPublishedAt?.getTime());
    },
    15000,
  );
});
