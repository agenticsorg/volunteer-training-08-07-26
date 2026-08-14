import { SenderProfile } from '../domain/aggregates/sender-profile.aggregate';
import { SenderProfileRepository } from '../infrastructure/repositories/sender-profile.repository';
import { ContactsApiAdapter } from '../infrastructure/adapters/contacts-api.adapter';
import { AutomatedSenderSignal, ContactClassification } from '../domain/value-objects/contact-classification';
import { InteractionEvent } from '../domain/entities/interaction-event.entity';

// Mock PrismaService for tests (in-memory store)
class MockPrismaService {
  private store = new Map<string, any>();

  senderProfile = {
    upsert: jest.fn(async (args: any) => {
      const key = `${args.where.tenant_id_mailbox_id_sender_address.tenant_id}:${args.where.tenant_id_mailbox_id_sender_address.mailbox_id}:${args.where.tenant_id_mailbox_id_sender_address.sender_address}`;
      const data = args.update || args.create;
      this.store.set(key, { ...args.where.tenant_id_mailbox_id_sender_address, ...data });
      return this.store.get(key);
    }),
    findUnique: jest.fn(async (args: any) => {
      const key = `${args.where.tenant_id_mailbox_id_sender_address.tenant_id}:${args.where.tenant_id_mailbox_id_sender_address.mailbox_id}:${args.where.tenant_id_mailbox_id_sender_address.sender_address}`;
      return this.store.get(key) || null;
    }),
    findMany: jest.fn(async (args: any) => {
      const results: any[] = [];
      for (const [key, value] of this.store.entries()) {
        if (key.startsWith(`${args.where.tenant_id}:${args.where.mailbox_id}:`)) {
          results.push(value);
        }
      }
      return results;
    }),
    deleteMany: jest.fn(async (args: any) => {
      const prefix = `${args.where.tenant_id}:`;
      for (const [key] of this.store.entries()) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
      return { count: this.store.size };
    }),
  };
}

describe('Contact Graph - Stage 5', () => {
  describe('SenderProfile Aggregate', () => {
    it('should compute weighted ContactClassification from multiple signals', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');

      // All positive signals should result in high Personal confidence
      profile.updateClassification({
        automationHeaderAbsent: true,
        fromAddressValid: true,
        contactsApiMatch: true,
        bidirectionalThreadHistory: true,
        displayNamePersonal: true,
      });

      expect(profile.classification.classification).toBe('personal');
      expect(profile.classification.confidence).toBeGreaterThan(0.8);
    });

    it('should never use a single signal as hard gate', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'noreply@newsletter.com');

      // Only one positive signal (say, contacts match) should not guarantee Personal
      profile.updateClassification({
        automationHeaderAbsent: false,
        fromAddressValid: false,
        contactsApiMatch: true, // Only this is true
        bidirectionalThreadHistory: false,
        displayNamePersonal: false,
      });

      // Should not be marked Personal just because of one signal
      expect(profile.classification.classification).toBe('automated');
    });

    it('should allow bidirectional without forcing Personal', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'bot@automation.com');

      // Even with bidirectional thread history, other strong automation signals should override
      profile.updateClassification({
        automationHeaderAbsent: false,
        fromAddressValid: false,
        contactsApiMatch: false,
        bidirectionalThreadHistory: true, // Present but...
        displayNamePersonal: false,
      });

      // Still classified as automated due to other signals
      expect(profile.classification.classification).toBe('automated');
    });

    it('should allow auto-promotion to VIP only after sustained bidirectional interaction', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');
      profile.updateClassification({
        automationHeaderAbsent: true,
        fromAddressValid: true,
        contactsApiMatch: true,
        bidirectionalThreadHistory: true,
        displayNamePersonal: true,
      });

      // Single outbound interaction should not immediately promote to VIP
      profile.recordInteraction('outbound', 'msg-1', new Date());
      expect(profile.isVip).toBe(false);
      expect(profile.vipAutoPromoted).toBe(false);

      // After sustained interaction (e.g., 5 bidirectional within 30 days), promote
      for (let i = 2; i <= 5; i++) {
        profile.recordInteraction('outbound', `msg-${i}`, new Date());
      }
      profile.promoteToVipIfQualified(5, 30);

      expect(profile.isVip).toBe(true);
      expect(profile.vipAutoPromoted).toBe(true);
    });

    it('should prevent VIP promotion if not Personal or manually overridden', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'bot@service.com');
      profile.updateClassification({
        automationHeaderAbsent: false,
        fromAddressValid: false,
        contactsApiMatch: false,
        bidirectionalThreadHistory: false,
        displayNamePersonal: false,
      });

      // Record lots of interaction on an automated sender
      for (let i = 1; i <= 10; i++) {
        profile.recordInteraction('outbound', `msg-${i}`, new Date());
      }

      // Should not auto-promote to VIP even with high interaction
      profile.promoteToVipIfQualified(5, 30);
      expect(profile.isVip).toBe(false);
      expect(profile.vipAutoPromoted).toBe(false);
    });

    it('should allow manual VIP override regardless of classification', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'support@company-shared.com');
      profile.updateClassification({
        automationHeaderAbsent: false,
        fromAddressValid: false,
        contactsApiMatch: false,
        bidirectionalThreadHistory: false,
        displayNamePersonal: false,
      });

      // Manually set to VIP (e.g., user action)
      profile.setManualVipDesignation(true);
      expect(profile.isVip).toBe(true);
      expect(profile.vipAutoPromoted).toBe(false);
    });

    it('should maintain append-only interaction history', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');

      const msg1 = new Date('2024-01-01T10:00:00Z');
      const msg2 = new Date('2024-01-02T10:00:00Z');

      profile.recordInteraction('inbound', 'msg-1', msg1);
      profile.recordInteraction('outbound', 'msg-2', msg2);

      const events = profile.getInteractionEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ direction: 'inbound', messageId: 'msg-1', occurredAt: msg1 });
      expect(events[1]).toMatchObject({ direction: 'outbound', messageId: 'msg-2', occurredAt: msg2 });

      // Cannot reset or mutate history (append-only invariant)
      // The return type is readonly, so mutation would be a type error
    });

    it('should compute interaction frequency within a rolling window', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');
      const now = new Date();

      // 3 inbound, 2 outbound in last 30 days
      profile.recordInteraction('inbound', 'msg-1', new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
      profile.recordInteraction('outbound', 'msg-2', new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
      profile.recordInteraction('inbound', 'msg-3', new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000));
      profile.recordInteraction('outbound', 'msg-4', new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000));
      profile.recordInteraction('inbound', 'msg-5', new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000));

      // Old interaction outside window
      profile.recordInteraction('inbound', 'msg-old', new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000));

      const freq = profile.computeInteractionFrequency(30); // 30 day window
      expect(freq.totalInteractions).toBe(5);
      expect(freq.bidirectionalCount).toBe(2);
      expect(freq.inboundCount).toBe(3);
      expect(freq.outboundCount).toBe(2);
      expect(freq.windowDays).toBe(30);
    });
  });

  describe('AutomatedSenderSignal Value Object', () => {
    it('should define weights per signal type', () => {
      const listUnsubscribeSignal = AutomatedSenderSignal.fromListUnsubscribeHeader(true);
      expect(listUnsubscribeSignal.weight).toBe(0.4); // High weight

      const noreplySignal = AutomatedSenderSignal.fromFromAddressPattern('noreply@example.com');
      expect(noreplySignal.weight).toBe(0.2); // Lower weight, but still contributes

      const displayNameSignal = AutomatedSenderSignal.fromDisplayNameHeuristic(true);
      expect(displayNameSignal.weight).toBe(0.1); // Low weight
    });
  });

  describe('ContactClassification Value Object', () => {
    it('should compute confidence as weighted average of contributing signals', () => {
      const signals = [
        AutomatedSenderSignal.fromListUnsubscribeHeader(false), // 0 contribution
        AutomatedSenderSignal.fromContactsApiMatch(true), // 0.4 weight
        AutomatedSenderSignal.fromBidirectionalHistory(true), // 0.4 weight
      ];

      const classification = ContactClassification.fromSignals(signals);

      // Both contributing signals are positive, weighted average should be high
      expect(classification.confidence).toBeGreaterThan(0.7);
      expect(classification.classification).toBe('personal');
    });

    it('should treat confidence threshold as 0.5 to determine Personal vs Automated', () => {
      const personalSignals = [
        AutomatedSenderSignal.fromListUnsubscribeHeader(false),
        AutomatedSenderSignal.fromContactsApiMatch(true),
      ];
      const personalClassification = ContactClassification.fromSignals(personalSignals);
      expect(personalClassification.classification).toBe('personal');

      const automatedSignals = [
        AutomatedSenderSignal.fromListUnsubscribeHeader(true),
        AutomatedSenderSignal.fromFromAddressPattern('noreply@service.com'),
      ];
      const automatedClassification = ContactClassification.fromSignals(automatedSignals);
      expect(automatedClassification.classification).toBe('automated');
    });
  });

  describe('ContactsApiAdapter', () => {
    it('should look up contact existence in Gmail People API', async () => {
      const adapter = new ContactsApiAdapter();
      const mockGmailToken = 'mock-gmail-token';

      const result = await adapter.lookupContact(mockGmailToken, 'gmail', 'alice@example.com');

      // Should return a match object or null
      expect(result).toBeDefined(); // Mocked or real behavior
      expect(result).toHaveProperty('exists'); // Boolean flag
      if (result?.exists) {
        expect(result).toHaveProperty('displayName');
        expect(result).toHaveProperty('lastInteractionDate');
      }
    });

    it('should look up contact existence in Outlook/Graph contacts', async () => {
      const adapter = new ContactsApiAdapter();
      const mockGraphToken = 'mock-graph-token';

      const result = await adapter.lookupContact(mockGraphToken, 'outlook', 'alice@example.com');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('exists');
    });

    it('should only expose existence/match, not frequency computation', async () => {
      const adapter = new ContactsApiAdapter();
      const mockToken = 'mock-token';

      // The adapter should NOT have a method like getInteractionFrequency
      // That computation is purely domain logic in SenderProfile, per ADR-0011
      expect(adapter.lookupContact).toBeDefined();
      expect((adapter as any).getInteractionFrequency).toBeUndefined();
    });
  });

  describe('SenderProfileRepository', () => {
    it('should load/save by (TenantId, MailboxId, SenderAddress) composite key', async () => {
      const mockPrisma = new MockPrismaService();
      const repository = new SenderProfileRepository(mockPrisma as any);

      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');
      profile.updateClassification({
        automationHeaderAbsent: true,
        fromAddressValid: true,
        contactsApiMatch: true,
        bidirectionalThreadHistory: true,
        displayNamePersonal: true,
      });

      await repository.save(profile);

      const loaded = await repository.loadBySender('tenant-1', 'mailbox-1', 'alice@example.com');
      expect(loaded).toBeDefined();
      expect(loaded?.classification.classification).toBe('personal');
    });

    it('should return null if sender profile does not exist', async () => {
      const mockPrisma = new MockPrismaService();
      const repository = new SenderProfileRepository(mockPrisma as any);
      const loaded = await repository.loadBySender('tenant-1', 'mailbox-1', 'unknown@example.com');
      expect(loaded).toBeNull();
    });

    it('should handle concurrent saves to the same profile', async () => {
      const mockPrisma = new MockPrismaService();
      const repository = new SenderProfileRepository(mockPrisma as any);

      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');

      // Simulate two saves happening concurrently
      await Promise.all([
        repository.save(profile),
        repository.save(profile),
      ]);

      const loaded = await repository.loadBySender('tenant-1', 'mailbox-1', 'alice@example.com');
      expect(loaded).toBeDefined();
    });
  });

  describe('Domain Events', () => {
    it('should publish SenderClassified event on classification', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');

      profile.updateClassification({
        automationHeaderAbsent: true,
        fromAddressValid: true,
        contactsApiMatch: true,
        bidirectionalThreadHistory: true,
        displayNamePersonal: true,
      });

      const events = profile.getDomainEvents();
      const classifiedEvent = events.find(e => e.type === 'SenderClassified');

      expect(classifiedEvent).toBeDefined();
      expect(classifiedEvent).toMatchObject({
        tenantId: 'tenant-1',
        mailboxId: 'mailbox-1',
        senderAddress: 'alice@example.com',
        classification: 'personal',
      });
    });

    it('should publish ContactPromotedToVip event on auto-promotion', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');
      profile.updateClassification({
        automationHeaderAbsent: true,
        fromAddressValid: true,
        contactsApiMatch: true,
        bidirectionalThreadHistory: true,
        displayNamePersonal: true,
      });

      // Record sufficient interactions
      for (let i = 1; i <= 5; i++) {
        profile.recordInteraction('outbound', `msg-${i}`, new Date());
      }

      profile.promoteToVipIfQualified(5, 30);

      const events = profile.getDomainEvents();
      const vipEvent = events.find(e => e.type === 'ContactPromotedToVip');

      expect(vipEvent).toBeDefined();
      expect(vipEvent).toMatchObject({
        tenantId: 'tenant-1',
        mailboxId: 'mailbox-1',
        senderAddress: 'alice@example.com',
        source: 'autoPromoted',
      });
    });

    it('should publish InteractionFrequencyUpdated event on periodic recompute', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'alice@example.com');

      const now = new Date();
      profile.recordInteraction('inbound', 'msg-1', new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
      profile.recordInteraction('outbound', 'msg-2', new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));

      profile.updateInteractionFrequency(30); // Trigger periodic recompute

      const events = profile.getDomainEvents();
      const freqEvent = events.find(e => e.type === 'InteractionFrequencyUpdated');

      expect(freqEvent).toBeDefined();
      expect(freqEvent).toMatchObject({
        tenantId: 'tenant-1',
        mailboxId: 'mailbox-1',
        senderAddress: 'alice@example.com',
        windowDays: 30,
      });
      expect(freqEvent).toHaveProperty('frequencyScore');
    });
  });
});
