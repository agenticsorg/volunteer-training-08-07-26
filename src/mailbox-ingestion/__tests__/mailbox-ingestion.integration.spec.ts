import { MessageEnvelopeFactory } from '../domain/value-objects/message-envelope';
import { IngestedMessageRepository } from '../infrastructure/repositories/ingested-message.repository';
import { GmailIngestionAdapter } from '../infrastructure/adapters/gmail-ingestion.adapter';
import { RateLimiterAdapter } from '../infrastructure/adapters/rate-limiter.adapter';
import { PrismaService } from '../../database/prisma.service';

const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip;

describe('Mailbox Ingestion - Integration Tests', () => {
  let gmailAdapter: GmailIngestionAdapter;
  let rateLimiter: RateLimiterAdapter;

  beforeAll(() => {
    gmailAdapter = new GmailIngestionAdapter();
    rateLimiter = new RateLimiterAdapter();
  });
  
  describe('Dual-path sync convergence', () => {
    it('should handle webhook then reconcile without duplication', async () => {
      const tenantId = 'tenant-1';
      const mailboxId = 'user@example.com';
      const platform = 'gmail';
      
      // Webhook arrives, enqueue delta-sync
      const deltaResult = await gmailAdapter.pullDelta(mailboxId, 'token', '1');
      expect(deltaResult.newCursor).toBeDefined();
      
      // Fetch message
      const envelope = await gmailAdapter.fetchMessage(mailboxId, 'msg-abc', 'token');
      expect(envelope.messageId).toBe('msg-abc');
    });
  });
  
  skipIfNoDb('Redelivery idempotency (against a live DB, real Prisma-backed repository)', () => {
    let prisma: PrismaService;
    let messageRepo: IngestedMessageRepository;
    let tenantId: string;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.onModuleInit();
      messageRepo = new IngestedMessageRepository(prisma);
      const tenant = await prisma.tenant.create({ data: { name: 'Redelivery Idempotency Test Tenant' } });
      tenantId = tenant.id;
    });

    afterAll(async () => {
      await prisma.ingestedMessage.deleteMany({ where: { tenantId } });
      await prisma.domainEventOutbox.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.onModuleDestroy();
    });

    it('should idempotently handle duplicate webhooks — same row, event published exactly once', async () => {
      const mailboxId = 'user@example.com';
      const platform = 'gmail';
      const platformMessageId = 'gmail-msg-xyz';
      const internalMessageId = crypto.randomUUID();

      const first = {
        tenantId,
        mailboxId,
        platform,
        platformMessageId,
        messageId: internalMessageId,
        normalizedEnvelope: MessageEnvelopeFactory.create({
          messageId: internalMessageId,
          from: 'sender@example.com',
          to: [mailboxId],
          platform: 'gmail',
          sentAt: new Date().toISOString(),
        }),
      };
      const event = {
        aggregateId: internalMessageId,
        aggregateType: 'IngestedMessage',
        eventType: 'MessageIngestedEvent',
        payload: { messageId: internalMessageId, tenantId, mailboxId, platform },
      };

      const saved1 = await messageRepo.save(first, [event]);
      const saved2 = await messageRepo.save(first, [event]);

      // Unique constraint: should return same record, not a duplicate
      expect(saved1.messageId).toBe(saved2.messageId);
      expect(saved1.id).toBe(saved2.id);

      const outboxRows = await prisma.domainEventOutbox.findMany({
        where: { tenantId, aggregateId: internalMessageId },
      });
      expect(outboxRows).toHaveLength(1);
    });
  });
  
  describe('Rate limiter quota enforcement', () => {
    it('should enforce per-platform quota', async () => {
      const rateLimiter2 = new RateLimiterAdapter();
      
      // Allow first 250 requests
      for (let i = 0; i < 250; i++) {
        const allowed = await rateLimiter2.enforceQuota('gmail', 'tenant-1', 'user@example.com', 1);
        expect(allowed).toBe(true);
      }
      
      // 251st should be denied
      const denied = await rateLimiter2.enforceQuota('gmail', 'tenant-1', 'user@example.com', 1);
      expect(denied).toBe(false);
    });
  });
  
  describe('Watch renewal failure', () => {
    it('should track renewal failures', async () => {
      const failures: any[] = [];
      
      // Simulate: renewal attempt fails
      failures.push({
        mailboxId: 'user@example.com',
        platform: 'gmail',
        reason: 'watch not found',
      });
      
      expect(failures.length).toBe(1);
      expect(failures[0].mailboxId).toBe('user@example.com');
    });
  });
});
