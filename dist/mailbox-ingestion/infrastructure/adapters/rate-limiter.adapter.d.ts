import { OnModuleDestroy } from '@nestjs/common';
import { RateLimiterPort } from './mailbox-sync.port';
export declare class RateLimiterAdapter implements RateLimiterPort, OnModuleDestroy {
    private counters;
    private resetTimers;
    enforceQuota(platform: string, tenantId: string, mailboxId: string, units: number): Promise<boolean>;
    getCurrentUsage(platform: string, tenantId: string, mailboxId: string): Promise<number>;
    onModuleDestroy(): void;
}
//# sourceMappingURL=rate-limiter.adapter.d.ts.map