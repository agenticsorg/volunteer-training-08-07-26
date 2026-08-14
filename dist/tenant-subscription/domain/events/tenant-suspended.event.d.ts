import { DomainEvent } from '@common/domain/domain-event';
export declare class TenantSuspended extends DomainEvent {
    readonly tenantId: string;
    readonly reason: string;
    constructor(tenantId: string, reason: string);
}
//# sourceMappingURL=tenant-suspended.event.d.ts.map