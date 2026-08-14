import { DomainEvent } from '@common/domain/domain-event';
export declare class PlanEntitlementsChanged extends DomainEvent {
    readonly tenantId: string;
    readonly planId: string;
    readonly entitlements: {
        mailboxLimit: number;
        llmTierCeiling: string;
        features: Record<string, unknown>;
    };
    readonly version: number;
    constructor(tenantId: string, planId: string, entitlements: {
        mailboxLimit: number;
        llmTierCeiling: string;
        features: Record<string, unknown>;
    }, version: number);
}
//# sourceMappingURL=plan-entitlements-changed.event.d.ts.map