export declare class UsageMeter {
    readonly id: string;
    readonly tenantId: string;
    readonly meterType: string;
    readonly billingPeriodStart: Date;
    readonly billingPeriodEnd: Date;
    usageCount: bigint;
    readonly overageThreshold: bigint;
    overageDetected: boolean;
    lastIncrementedAt?: Date | undefined;
    private uncommittedEvents;
    constructor(id: string, tenantId: string, meterType: string, billingPeriodStart: Date, billingPeriodEnd: Date, usageCount: bigint | undefined, overageThreshold: bigint, overageDetected?: boolean, lastIncrementedAt?: Date | undefined);
    atomicIncrement(amount: number): void;
    getUncommittedEvents(): any[];
    clearUncommittedEvents(): void;
}
//# sourceMappingURL=usage-meter.aggregate.d.ts.map