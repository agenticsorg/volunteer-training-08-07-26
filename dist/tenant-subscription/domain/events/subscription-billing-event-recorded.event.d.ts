import { DomainEvent } from '@common/domain/domain-event';
export declare class SubscriptionBillingEventRecorded extends DomainEvent {
    readonly tenantId: string;
    readonly eventType: string;
    readonly stripeEventId?: string | undefined;
    readonly payload?: unknown | undefined;
    constructor(tenantId: string, eventType: string, stripeEventId?: string | undefined, payload?: unknown | undefined);
}
//# sourceMappingURL=subscription-billing-event-recorded.event.d.ts.map