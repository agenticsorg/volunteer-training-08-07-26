export declare class Subscription {
    readonly id: string;
    readonly tenantId: string;
    currentPlanId: string;
    status: 'active' | 'past_due' | 'suspended' | 'canceled';
    planVersion: number;
    planChangedAt?: Date | undefined;
    stripeCustomerId?: string | undefined;
    stripeSubscriptionId?: string | undefined;
    private uncommittedEvents;
    constructor(id: string, tenantId: string, currentPlanId: string, status: 'active' | 'past_due' | 'suspended' | 'canceled', planVersion?: number, planChangedAt?: Date | undefined, stripeCustomerId?: string | undefined, stripeSubscriptionId?: string | undefined);
    changePlan(newPlanId: string, entitlements: any): void;
    markPastDue(): void;
    suspend(reason: string): void;
    unsuspend(): void;
    getUncommittedEvents(): any[];
    clearUncommittedEvents(): void;
}
//# sourceMappingURL=subscription.aggregate.d.ts.map