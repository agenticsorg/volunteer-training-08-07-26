import { DomainEvent } from '@common/domain/domain-event';

export class SubscriptionBillingEventRecorded extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly eventType: string,
    public readonly stripeEventId?: string,
    public readonly payload?: unknown,
  ) {
    super();
  }
}
