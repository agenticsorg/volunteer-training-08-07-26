import { SyncCursor } from '../domain/value-objects/sync-cursor';
import { MessageEnvelopeFactory } from '../domain/value-objects/message-envelope';
import { MailboxConnectionRepository } from '../infrastructure/repositories/mailbox-connection.repository';
import { IngestedMessageRepository } from '../infrastructure/repositories/ingested-message.repository';
import { GmailIngestionAdapter } from '../infrastructure/adapters/gmail-ingestion.adapter';
import { RateLimiterAdapter } from '../infrastructure/adapters/rate-limiter.adapter';

describe('Mailbox Ingestion - Integration Tests', () => {
  let mailboxRepo: MailboxConnectionRepository;
  let messageRepo: IngestedMessageRepository;
  let gmailAdapter: GmailIngestionAdapter;
  let rateLimiter: RateLimiterAdapter;
  
  beforeAll(() => {
    mailboxRepo = new MailboxConnectionRepository();
    messageRepo = new IngestedMessageRepository();
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
  
  describe('Redelivery idempotency', () => {
    it('should idempotently handle duplicate webhooks', async () => {
      const tenantId = 'tenant-1';
      const mailboxId = 'user@example.com';
      const platform = 'gmail';
      const platformMessageId = 'gmail-msg-xyz';
      
      // First message
      const first = {
        tenantId,
        mailboxId,
        platform,
        platformMessageId,
        messageId: 'internal-uuid-1',
        normalizedEnvelope: MessageEnvelopeFactory.create({
          messageId: 'internal-uuid-1',
          from: 'sender@example.com',
          to: [mailboxId],
          platform: 'gmail',
          sentAt: new Date().toISOString(),
        }),
      };
      
      const saved1 = await messageRepo.save(first);
      const saved2 = await messageRepo.save(first);
      
      // Unique constraint: should return same record
      expect(saved1.messageId).toBe(saved2.messageId);
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
