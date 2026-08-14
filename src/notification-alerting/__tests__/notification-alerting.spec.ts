import { NotificationSubscription } from '../domain/aggregates/notification-subscription.aggregate';
import { AlertDispatch } from '../domain/aggregates/alert-dispatch.aggregate';
import { NotificationPreference } from '../domain/value-objects/notification-preference';
import { AlertPayload } from '../domain/value-objects/alert-payload';
import { DigestWindow } from '../domain/value-objects/digest-window';

describe('Notification & Alerting — Stage 10', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-456';

  describe('NotificationSubscription aggregate', () => {
    it('should create with safe defaults', () => {
      const sub = NotificationSubscription.create(tenantId, userId, ['push']);

      const quarantinePrefs = sub.getPreference('message_quarantined');
      expect(quarantinePrefs?.isImmediate()).toBe(true);
      expect(quarantinePrefs?.deliveryMode).toBe('immediate');

      const priorityPrefs = sub.getPreference('priority_escalated');
      expect(priorityPrefs?.deliveryMode).toBe('digest_only');

      const needsReplyPrefs = sub.getPreference('needs_reply_aging');
      expect(needsReplyPrefs?.deliveryMode).toBe('digest_only');
    });

    it('should prevent immediate delivery on unauthorized channels', () => {
      const sub = NotificationSubscription.create(tenantId, userId, []); // no channels

      const preference = new NotificationPreference(
        'priority_escalated',
        'immediate',
        'sms',
      );

      expect(() => {
        sub.updatePreference('priority_escalated', preference);
      }).toThrow('not authorized');
    });

    it('should allow immediate delivery on authorized channels', () => {
      const sub = NotificationSubscription.create(tenantId, userId, [
        'push',
        'sms',
      ]);

      const preference = new NotificationPreference(
        'message_quarantined',
        'immediate',
        'sms',
      );

      sub.updatePreference('message_quarantined', preference);
      expect(sub.shouldNotifyImmediately('message_quarantined')).toBe(true);
    });

    it('should track authorized channels', () => {
      const sub = NotificationSubscription.create(tenantId, userId, ['push']);

      expect(sub.isChannelAuthorized('push')).toBe(true);
      expect(sub.isChannelAuthorized('sms')).toBe(false);

      sub.authorizeChannel('sms');
      expect(sub.isChannelAuthorized('sms')).toBe(true);

      sub.revokeChannel('push');
      expect(sub.isChannelAuthorized('push')).toBe(false);
    });

    it('should serialize and deserialize', () => {
      const sub = NotificationSubscription.create(tenantId, userId, [
        'push',
        'in_app',
      ]);

      sub.updatePreference(
        'priority_escalated',
        new NotificationPreference('priority_escalated', 'immediate', 'push'),
      );

      const db = sub.toDb();
      expect(db.authorized_channels).toContain('push');
      expect(db.authorized_channels).toContain('in_app');

      const restored = NotificationSubscription.fromDb(db);
      expect(restored.shouldNotifyImmediately('priority_escalated')).toBe(true);
      expect(restored.isChannelAuthorized('push')).toBe(true);
    });

    it('should disable notifications per event type', () => {
      const sub = NotificationSubscription.create(tenantId, userId, ['push']);

      const disabledPrefs = new NotificationPreference(
        'needs_reply_aging',
        'off',
        'push',
      );

      sub.updatePreference('needs_reply_aging', disabledPrefs);

      const pref = sub.getPreference('needs_reply_aging');
      expect(pref?.isEnabled()).toBe(false);
    });
  });

  describe('AlertDispatch aggregate', () => {
    it('should create with pending status', () => {
      const payload = AlertPayload.fromQuarantine('example.com');
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'message_quarantined',
        payload,
        'push',
      );

      expect(alert.status).toBe('pending');
      expect(alert.tenantId).toBe(tenantId);
      expect(alert.userId).toBe(userId);
      expect(alert.payload.severity).toBe('critical');
    });

    it('should transition from pending to dispatched', () => {
      const payload = AlertPayload.fromPriorityEscalation('John', 'Critical');
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'priority_escalated',
        payload,
        'push',
      );

      alert.dispatch();
      expect(alert.status).toBe('dispatched');
    });

    it('should enforce cool-down window', () => {
      const payload = AlertPayload.fromNeedsReplyAging(5);
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'needs_reply_aging',
        payload,
        'in_app',
        15, // 15-minute cool-down
      );

      const now = new Date();
      expect(alert.isInCoolDown(now)).toBe(true);

      const later = new Date(now.getTime() + 20 * 60 * 1000); // 20 minutes later
      expect(alert.isInCoolDown(later)).toBe(false);
    });

    it('should allow custom cool-down windows', () => {
      const payload = AlertPayload.fromQuarantine('phishing.com');
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'message_quarantined',
        payload,
        'push',
        5, // 5-minute cool-down
      );

      const now = new Date();
      expect(alert.isInCoolDown(now)).toBe(true);

      const after5min = new Date(now.getTime() + 6 * 60 * 1000);
      expect(alert.isInCoolDown(after5min)).toBe(false);
    });

    it('should mark failed alerts', () => {
      const payload = AlertPayload.fromQuarantine('badmail.com');
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'message_quarantined',
        payload,
        'sms',
      );

      alert.markFailed();
      expect(alert.status).toBe('failed');
    });

    it('should serialize and deserialize', () => {
      const payload = AlertPayload.fromPriorityEscalation('Alice', 'High');
      const alert = AlertDispatch.create(
        tenantId,
        userId,
        'priority_escalated',
        payload,
        'push',
      );

      alert.dispatch();

      const db = alert.toDb();
      expect(db.status).toBe('dispatched');
      expect(db.tenant_id).toBe(tenantId);

      const restored = AlertDispatch.fromDb(db);
      expect(restored.status).toBe('dispatched');
      expect(restored.eventType).toBe('priority_escalated');
    });
  });

  describe('NotificationPreference value object', () => {
    it('should classify delivery modes', () => {
      const immediate = NotificationPreference.messageQuarantined();
      expect(immediate.isImmediate()).toBe(true);
      expect(immediate.isEnabled()).toBe(true);

      const digestOnly = NotificationPreference.priorityEscalated();
      expect(digestOnly.isImmediate()).toBe(false);
      expect(digestOnly.isEnabled()).toBe(true);

      const disabled = new NotificationPreference(
        'needs_reply_aging',
        'off',
        'push',
      );
      expect(disabled.isEnabled()).toBe(false);
    });

    it('should provide safe default preferences', () => {
      const quarantine = NotificationPreference.messageQuarantined();
      expect(quarantine.preferredChannel).toBe('push');
      expect(quarantine.deliveryMode).toBe('immediate');

      const priority = NotificationPreference.priorityEscalated();
      expect(priority.preferredChannel).toBe('digest_email');

      const needsReply = NotificationPreference.needsReplyAging();
      expect(needsReply.deliveryMode).toBe('digest_only');
    });
  });

  describe('AlertPayload value object', () => {
    it('should create quarantine alert with critical severity', () => {
      const payload = AlertPayload.fromQuarantine('malware.com');

      expect(payload.triggeringEvent).toBe('message_quarantined');
      expect(payload.severity).toBe('critical');
      expect(payload.renderedSummary).toContain('malware.com');
    });

    it('should create priority escalation alert', () => {
      const payload = AlertPayload.fromPriorityEscalation('CEO', 'Critical');

      expect(payload.triggeringEvent).toBe('priority_escalated');
      expect(payload.severity).toBe('high');
      expect(payload.renderedSummary).toContain('CEO');
      expect(payload.renderedSummary).toContain('Critical');
    });

    it('should create needs-reply aging alert', () => {
      const payload = AlertPayload.fromNeedsReplyAging(7);

      expect(payload.triggeringEvent).toBe('needs_reply_aging');
      expect(payload.severity).toBe('normal');
      expect(payload.renderedSummary).toContain('7 days');
    });
  });

  describe('DigestWindow value object', () => {
    it('should create daily digest window', () => {
      const window = DigestWindow.daily();

      expect(window.cadence).toBe('daily');
      expect(window.durationDays()).toBe(1);
    });

    it('should create weekly digest window', () => {
      const window = DigestWindow.weekly();

      expect(window.cadence).toBe('weekly');
      expect(window.durationDays()).toBe(7);
    });

    it('should check date containment', () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);

      const window = DigestWindow.custom(start, end, 'daily');

      const midpoint = new Date(start.getTime() + 12 * 60 * 60 * 1000);
      expect(window.containsDate(midpoint)).toBe(true);

      const afterEnd = new Date(end.getTime() + 1000);
      expect(window.containsDate(afterEnd)).toBe(false);
    });

    it('should calculate duration correctly', () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 5);

      const window = DigestWindow.custom(start, end, 'weekly');
      expect(window.durationDays()).toBe(5);
    });
  });

  describe('Rate-limiting scenarios', () => {
    it('should prevent alert storms within cool-down', () => {
      const alerts = [];

      for (let i = 0; i < 3; i++) {
        const payload = AlertPayload.fromPriorityEscalation('VIP', 'Critical');
        const alert = AlertDispatch.create(
          tenantId,
          userId,
          'priority_escalated',
          payload,
          'push',
          15, // 15-min cool-down
        );
        alerts.push(alert);
      }

      // First alert should be allowed
      const now = new Date();
      expect(alerts[0].isInCoolDown(now)).toBe(true);

      // Second alert within cool-down should be rate-limited
      expect(alerts[1].isInCoolDown(now)).toBe(true);

      // After cool-down expires, new alerts allowed
      const later = new Date(now.getTime() + 20 * 60 * 1000);
      expect(alerts[0].isInCoolDown(later)).toBe(false);
      expect(alerts[1].isInCoolDown(later)).toBe(false);
    });
  });
});
