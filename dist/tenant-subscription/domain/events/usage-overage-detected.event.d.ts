import { DomainEvent } from '@common/domain/domain-event';
export declare class UsageOverageDetected extends DomainEvent {
    readonly tenantId: string;
    readonly meterType: string;
    readonly billingPeriodStart: Date;
    readonly billingPeriodEnd: Date;
    readonly usage: number;
    readonly threshold: number;
    constructor(tenantId: string, meterType: string, billingPeriodStart: Date, billingPeriodEnd: Date, usage: number, threshold: number);
}
//# sourceMappingURL=usage-overage-detected.event.d.ts.map