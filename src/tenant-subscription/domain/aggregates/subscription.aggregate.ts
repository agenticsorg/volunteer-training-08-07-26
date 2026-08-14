import { PlanEntitlementsChanged } from '../events/plan-entitlements-changed.event';
import { TenantSuspended } from '../events/tenant-suspended.event';

export class Subscription {
  private uncommittedEvents: any[] = [];

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public currentPlanId: string,
    public status: 'active' | 'past_due' | 'suspended' | 'canceled',
    public planVersion: number = 1,
    public planChangedAt?: Date,
    public stripeCustomerId?: string,
    public stripeSubscriptionId?: string,
  ) {}

  changePlan(newPlanId: string, entitlements: any): void {
    if (this.currentPlanId === newPlanId) return;

    this.currentPlanId = newPlanId;
    this.planVersion += 1;
    this.planChangedAt = new Date();

    this.uncommittedEvents.push(
      new PlanEntitlementsChanged(this.tenantId, newPlanId, entitlements, this.planVersion),
    );
  }

  markPastDue(): void {
    this.status = 'past_due';
    this.uncommittedEvents.push(new TenantSuspended(this.tenantId, 'payment_failed'));
  }

  suspend(reason: string): void {
    this.status = 'suspended';
    this.uncommittedEvents.push(new TenantSuspended(this.tenantId, reason));
  }

  unsuspend(): void {
    if (this.status === 'suspended') {
      this.status = 'active';
    }
  }

  getUncommittedEvents(): any[] {
    return this.uncommittedEvents;
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }
}
