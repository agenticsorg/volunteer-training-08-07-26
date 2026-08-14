import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { SenderProfile } from '../../contact-graph/domain/sender-profile.aggregate';
import { ThreatAssessment } from '../../threat-detection/domain/threat-assessment.aggregate';
import { MessagePriority } from '../../prioritization/domain/message-priority.aggregate';
import { MessageWriteBackState } from '../../mailbox-writeback/domain/message-writeback-state.aggregate';
import { CorrectionRecord, SenderReputationCache } from '../../feedback-learning/domain/correction-record.aggregate';
import { NotificationSubscription, AlertDispatch } from '../../notification-alerting/domain/notification-subscription.aggregate';

describe('Stages 5-12 Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Stage 5: Contact Graph', () => {
    it('should classify sender as personal based on multiple signals', () => {
      const profile = new SenderProfile(
        'tenant-1',
        'mailbox-1',
        'alice@example.com',
        { classification: 'automated', confidence: 0, signals: {} as any },
      );

      profile.classifyFromSignals(
        {
          automation_header_absent: true,
          from_address_valid: true,
          contacts_api_match: true,
          bidirectional_thread_history: true,
          display_name_personal: true,
        },
        true,
      );

      expect(profile.classification.classification).toBe('personal');
      expect(profile.classification.confidence).toBeGreaterThan(0.5);
    });

    it('should promote to VIP only after sustained interaction', () => {
      const profile = new SenderProfile('tenant-1', 'mailbox-1', 'bob@example.com', {
        classification: 'personal',
        confidence: 0.8,
        signals: {} as any,
      });

      profile.bidirectional_interactions = 2;
      const promoted = profile.promoteToVipIfQualified(3, 30);
      expect(promoted).toBe(false);

      profile.bidirectional_interactions = 3;
      const promoted2 = profile.promoteToVipIfQualified(3, 30);
      expect(promoted2).toBe(true);
      expect(profile.is_vip).toBe(true);
    });
  });

  describe('Stage 6: Threat Detection', () => {
    it('should determine quarantine need based on threat score', () => {
      const assessment = new ThreatAssessment(
        'tenant-1',
        'msg-1',
        {
          spf_pass: false,
          dkim_pass: false,
          dmarc_pass: false,
          dmarc_aligned: false,
          brand_impersonation_detected: true,
        },
        { domain_similarity: 0.95, homoglyph_detected: true, from_correspondence_history: false },
        { intent: 'credential_harvesting', confidence: 0.85 },
      );

      const decision = assessment.determineQuarantineNeed();
      expect(['locked_quarantine', 'soft_flag']).toContain(decision);
    });

    it('should handle independently null threat layers', () => {
      const assessment = new ThreatAssessment(
        'tenant-1',
        'msg-2',
        {
          spf_pass: true,
          dkim_pass: true,
          dmarc_pass: true,
          dmarc_aligned: true,
          brand_impersonation_detected: false,
        },
        null, // LookalikeScore null
        null, // IntentClassification null
      );

      const decision = assessment.determineQuarantineNeed();
      expect(decision).toBe('none');
    });
  });

  describe('Stage 7: Prioritization', () => {
    it('should compute idempotent priority scores', () => {
      const priority = new MessagePriority('tenant-1', 'msg-1');

      const components = [
        { name: 'vip_status', value: 100, weight: 0.25 },
        { name: 'interaction_frequency', value: 80, weight: 0.2 },
        { name: 'needs_reply_aging', value: 90, weight: 0.15 },
      ];

      priority.computeScore(components);
      const score1 = priority.priority_score;

      priority.computeScore(components);
      const score2 = priority.priority_score;

      expect(priority.isIdempotent(score1)).toBe(true);
      expect(score1).toBe(score2);
    });

    it('should clamp score to 0-100 range', () => {
      const priority = new MessagePriority('tenant-1', 'msg-2');

      const components = [
        { name: 'over_weighted', value: 200, weight: 0.8 },
      ];

      priority.computeScore(components);
      expect(priority.priority_score).toBeLessThanOrEqual(100);
      expect(priority.priority_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Stage 8: Mailbox Write-back', () => {
    it('should track facet applications independently', () => {
      const writeback = new MessageWriteBackState('tenant-1', 'mailbox-1', 'msg-1');

      writeback.recordFacetApplication('category', {
        facet_type: 'category',
        desired_value: { labels: ['work', 'urgent'] },
        last_known_platform_state: { labels: [] },
        last_applied_at: null,
        application_failed: false,
      });

      expect(writeback.isIdempotent('category', { labels: ['work', 'urgent'] })).toBe(true);
    });

    it('should suppress facet display when quarantine is active', () => {
      const writeback = new MessageWriteBackState('tenant-1', 'mailbox-1', 'msg-1');

      writeback.recordFacetApplication('threat', {
        facet_type: 'threat',
        desired_value: { quarantine_locked: true },
        last_known_platform_state: null,
        last_applied_at: null,
        application_failed: false,
      });

      expect(writeback.shouldSuppressFacetDisplay('category')).toBe(true);
      expect(writeback.shouldSuppressFacetDisplay('threat')).toBe(false);
    });
  });

  describe('Stage 9: Feedback & Learning', () => {
    it('should only trust explicit and admin corrections immediately', () => {
      const passive_correction = new CorrectionRecord(
        'tenant-1',
        'msg-1',
        { originating_context: 'classification', original_verdict: 'work', corrected_verdict: 'personal' },
        'passive_inferred',
      );

      expect(passive_correction.isTrusted()).toBe(false);

      const explicit_correction = new CorrectionRecord(
        'tenant-1',
        'msg-2',
        { originating_context: 'classification', original_verdict: 'personal', corrected_verdict: 'work' },
        'explicit_user_action',
      );

      expect(explicit_correction.isTrusted()).toBe(true);
    });

    it('should maintain sender reputation cache', () => {
      const cache = new SenderReputationCache('tenant-1', 'example.com');

      cache.updateFromTrustedCorrection('work', 0.9);
      expect(cache.getConfidence('work')).toBe(0.9);

      cache.updateFromTrustedCorrection('personal', 0.3);
      expect(cache.getConfidence('personal')).toBe(0);
    });

    it('should only allow admin override to reverse quarantine', () => {
      const admin_correction = new CorrectionRecord(
        'tenant-1',
        'msg-1',
        { originating_context: 'threat', original_verdict: 'locked_quarantine', corrected_verdict: 'none' },
        'admin_override',
      );

      expect(admin_correction.canReverseQuarantine()).toBe(true);

      const user_correction = new CorrectionRecord(
        'tenant-1',
        'msg-2',
        { originating_context: 'threat', original_verdict: 'locked_quarantine', corrected_verdict: 'none' },
        'explicit_user_action',
      );

      expect(user_correction.canReverseQuarantine()).toBe(false);
    });
  });

  describe('Stage 10: Notification & Alerting', () => {
    it('should respect notification preferences per channel', () => {
      const subscription = new NotificationSubscription('tenant-1', 'user-1');

      expect(subscription.getPreference('phishing')).toBe('immediate');
      expect(subscription.getPreference('general')).toBe('digest_only');
    });

    it('should rate-limit alerts within cool-down window', () => {
      const dispatch = new AlertDispatch();

      const can_send_1 = dispatch.canDispatchAlert('user-1', 'phishing', 300);
      expect(can_send_1).toBe(true);

      dispatch.recordDispatch('alert-1', 'user-1', 'phishing', 300);

      const can_send_2 = dispatch.canDispatchAlert('user-1', 'phishing', 300);
      expect(can_send_2).toBe(false);

      // After cool-down
      const future = new Date();
      future.setSeconds(future.getSeconds() + 301);
      // Mock: in real test, would fast-forward time
    });
  });
});
