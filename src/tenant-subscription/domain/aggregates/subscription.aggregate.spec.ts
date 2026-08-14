import { Subscription } from './subscription.aggregate';
import { PlanEntitlementsChanged } from '../events/plan-entitlements-changed.event';
import { TenantSuspended } from '../events/tenant-suspended.event';

describe('Subscription Aggregate', () => {
  describe('plan versioning', () => {
    it('should increment version when plan changes', () => {
      const subscription = new Subscription(
        'sub-1',
        'tenant-1',
        'plan-a',
        'active',
        1,
      );

      expect(subscription.planVersion).toBe(1);

      subscription.changePlan('plan-b', {
        mailboxLimit: 100,
        llmTierCeiling: 'tier-2',
        features: {},
      });

      expect(subscription.planVersion).toBe(2);
      expect(subscription.currentPlanId).toBe('plan-b');
    });

    it('should emit PlanEntitlementsChanged event on plan change', () => {
      const subscription = new Subscription('sub-1', 'tenant-1', 'plan-a', 'active');

      const entitlements = {
        mailboxLimit: 100,
        llmTierCeiling: 'tier-2',
        features: { feature1: true },
      };

      subscription.changePlan('plan-b', entitlements);

      const events = subscription.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PlanEntitlementsChanged);
      expect((events[0] as PlanEntitlementsChanged).planId).toBe('plan-b');
      expect((events[0] as PlanEntitlementsChanged).version).toBe(2);
    });

    it('should not change plan if same plan', () => {
      const subscription = new Subscription('sub-1', 'tenant-1', 'plan-a', 'active', 1);

      subscription.changePlan('plan-a', { mailboxLimit: 50, llmTierCeiling: 'tier-1', features: {} });

      expect(subscription.planVersion).toBe(1);
      expect(subscription.getUncommittedEvents().length).toBe(0);
    });
  });

  describe('suspension', () => {
    it('should mark subscription as past_due and emit event', () => {
      const subscription = new Subscription('sub-1', 'tenant-1', 'plan-a', 'active');

      subscription.markPastDue();

      expect(subscription.status).toBe('past_due');
      const events = subscription.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(TenantSuspended);
    });

    it('should suspend subscription and emit event', () => {
      const subscription = new Subscription('sub-1', 'tenant-1', 'plan-a', 'active');

      subscription.suspend('payment_failed');

      expect(subscription.status).toBe('suspended');
      const events = subscription.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(TenantSuspended);
    });

    it('should unsuspend subscription', () => {
      const subscription = new Subscription('sub-1', 'tenant-1', 'plan-a', 'suspended');

      subscription.unsuspend();

      expect(subscription.status).toBe('active');
    });
  });
});
