import { CorrectionRecord } from '../domain/aggregates/correction-record.aggregate';
import { SenderReputationCache } from '../domain/aggregates/sender-reputation-cache.aggregate';
import { VerdictSnapshot } from '../domain/value-objects/verdict-snapshot';
import { CorrectionEvidence } from '../domain/value-objects/correction-evidence';
import { ReputationEntry } from '../domain/value-objects/reputation-entry';

describe('Feedback & Learning — Stage 9', () => {
  const tenantId = 'tenant-123';
  const messageId = 'msg-456';
  const senderDomain = 'example.com';

  describe('CorrectionRecord aggregate', () => {
    it('should create a correction record with explicit user action', () => {
      const snapshot = new VerdictSnapshot(
        'classification',
        messageId,
        { category: 'Newsletter' },
        { category: 'Personal' },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'explicit_user_action');

      expect(record.tenantId).toBe(tenantId);
      expect(record.messageId).toBe(messageId);
      expect(record.state).toBe('confirmed');
      expect(record.isTrusted()).toBe(true);
    });

    it('should create a candidate correction record for passive inferred source', () => {
      const snapshot = new VerdictSnapshot(
        'classification',
        messageId,
        { category: 'Newsletter' },
        { category: 'Social' },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'passive_inferred');

      expect(record.state).toBe('candidate');
      expect(record.isTrusted()).toBe(false);
    });

    it('should detect different verdicts', () => {
      const snapshot = new VerdictSnapshot(
        'threat',
        messageId,
        { phishing: false },
        { phishing: true },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'admin_override');

      expect(record.isDifferent()).toBe(true);
      expect(record.evidence.requiresAdminOverride()).toBe(true);
    });

    it('should corroborate passive inferred corrections', () => {
      const snapshot = new VerdictSnapshot(
        'classification',
        messageId,
        { category: 'Social' },
        { category: 'LinkedIn' },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'passive_inferred');

      expect(record.state).toBe('candidate');
      expect(record.evidence.corroborationCount).toBe(0);

      record.corroborate();
      expect(record.evidence.corroborationCount).toBe(1);
      expect(record.state).toBe('candidate');

      record.corroborate();
      expect(record.evidence.corroborationCount).toBe(2);
      expect(record.state).toBe('confirmed');
    });

    it('should transition through state machine: candidate → confirmed → processed', () => {
      const snapshot = new VerdictSnapshot(
        'priority',
        messageId,
        { tier: 'Normal' },
        { tier: 'High' },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'explicit_user_action');

      expect(record.state).toBe('confirmed');

      record.markProcessed();
      expect(record.state).toBe('processed');
    });

    it('should serialize and deserialize to/from database', () => {
      const snapshot = new VerdictSnapshot(
        'contact',
        messageId,
        { personal: false },
        { personal: true },
        new Date(),
      );

      const record = CorrectionRecord.create(tenantId, messageId, snapshot, 'explicit_user_action');
      const db = record.toDb();

      expect(db.tenant_id).toBe(tenantId);
      expect(db.message_id).toBe(messageId);
      expect(db.source).toBe('explicit_user_action');
      expect(db.state).toBe('confirmed');
    });
  });

  describe('SenderReputationCache aggregate', () => {
    it('should create an empty reputation cache', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      expect(cache.tenantId).toBe(tenantId);
      expect(cache.senderDomain).toBe(senderDomain);
      expect(cache.getMostLikelyCategory()).toBeNull();
    });

    it('should record a category with confidence', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      cache.recordCategory('Newsletter', 0.85);

      expect(cache.getMostLikelyCategory()).toBe('Newsletter');
      expect(cache.getCategoryConfidence('Newsletter')).toBe(0.85);
    });

    it('should track multiple categories and find the highest confidence', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      cache.recordCategory('Newsletter', 0.9);
      cache.recordCategory('Social', 0.6);
      cache.recordCategory('Ecommerce', 0.75);

      expect(cache.getMostLikelyCategory()).toBe('Newsletter');
      expect(cache.getCategoryConfidence('Newsletter')).toBe(0.9);
    });

    it('should boost confidence on repeated observations', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      cache.recordCategory('Personal', 0.8);
      const initialConfidence = cache.getCategoryConfidence('Personal');

      cache.recordCategory('Personal', 0.8);
      const boostedConfidence = cache.getCategoryConfidence('Personal');

      expect(boostedConfidence).toBeGreaterThan(initialConfidence!);
    });

    it('should identify high-confidence categories', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      cache.recordCategory('VIP', 0.95);
      cache.recordCategory('Work', 0.85);
      cache.recordCategory('Spam', 0.4);

      const highConfidence = cache.getHighConfidenceCategories(0.7);

      expect(highConfidence).toContain('VIP');
      expect(highConfidence).toContain('Work');
      expect(highConfidence).not.toContain('Spam');
    });

    it('should serialize to database format', () => {
      const cache = SenderReputationCache.create(tenantId, senderDomain);

      cache.recordCategory('Newsletter', 0.8);
      cache.recordCategory('Personal', 0.9);

      const db = cache.toDb();

      expect(db.tenant_id).toBe(tenantId);
      expect(db.sender_domain).toBe(senderDomain);
      expect(db.category_confidence.Newsletter).toBeDefined();
      expect(db.category_confidence.Personal).toBeDefined();
    });
  });

  describe('ReputationEntry value object', () => {
    it('should create a reputation entry with initial confidence', () => {
      const entry = new ReputationEntry('Newsletter', 1, 0.75, new Date());

      expect(entry.category).toBe('Newsletter');
      expect(entry.observationCount).toBe(1);
      expect(entry.confidenceWeight).toBe(0.75);
    });

    it('should boost confidence on additional observations', () => {
      let entry = new ReputationEntry('Personal', 1, 0.7, new Date());

      entry = entry.withAdditionalObservation(0.05);

      expect(entry.observationCount).toBe(2);
      expect(entry.confidenceWeight).toBe(0.75);
    });

    it('should cap confidence at 1.0', () => {
      let entry = new ReputationEntry('VIP', 1, 0.95, new Date());

      entry = entry.withAdditionalObservation(0.1);

      expect(entry.confidenceWeight).toBe(1.0);
    });

    it('should identify high confidence entries', () => {
      const highConfidence = new ReputationEntry('VIP', 5, 0.8, new Date());
      const lowConfidence = new ReputationEntry('Spam', 2, 0.4, new Date());

      expect(highConfidence.isHighConfidence(0.7)).toBe(true);
      expect(lowConfidence.isHighConfidence(0.7)).toBe(false);
    });
  });

  describe('CorrectionEvidence value object', () => {
    it('should classify explicit user action as high trust', () => {
      const evidence = new CorrectionEvidence('explicit_user_action', new Date());

      expect(evidence.isHighTrust()).toBe(true);
    });

    it('should classify admin override as high trust and requiring admin', () => {
      const evidence = new CorrectionEvidence('admin_override', new Date());

      expect(evidence.isHighTrust()).toBe(true);
      expect(evidence.requiresAdminOverride()).toBe(true);
    });

    it('should classify passive inferred as low trust', () => {
      const evidence = new CorrectionEvidence('passive_inferred', new Date());

      expect(evidence.isHighTrust()).toBe(false);
      expect(evidence.requiresAdminOverride()).toBe(false);
    });

    it('should track corroboration count', () => {
      let evidence = new CorrectionEvidence('passive_inferred', new Date(), 0);

      evidence = evidence.withAdditionalCorroboration();
      expect(evidence.corroborationCount).toBe(1);

      evidence = evidence.withAdditionalCorroboration();
      expect(evidence.corroborationCount).toBe(2);
    });
  });

  describe('VerdictSnapshot value object', () => {
    it('should detect when verdicts differ', () => {
      const snapshot = new VerdictSnapshot(
        'classification',
        messageId,
        { category: 'Newsletter' },
        { category: 'Personal' },
        new Date(),
      );

      expect(snapshot.isDifferent()).toBe(true);
    });

    it('should detect when verdicts match', () => {
      const verdict = { category: 'Social' };
      const snapshot = new VerdictSnapshot(
        'classification',
        messageId,
        verdict,
        verdict,
        new Date(),
      );

      expect(snapshot.isDifferent()).toBe(false);
    });

    it('should serialize and deserialize', () => {
      const snapshot = new VerdictSnapshot(
        'threat',
        messageId,
        { phishing: false },
        { phishing: true },
        new Date(),
      );

      const db = snapshot.toDb();
      const restored = VerdictSnapshot.fromDb(db);

      expect(restored.originatingContext).toBe('threat');
      expect(restored.messageId).toBe(messageId);
      expect(restored.isDifferent()).toBe(true);
    });
  });
});
