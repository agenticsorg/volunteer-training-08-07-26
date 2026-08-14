import { PrismaService } from '@database/prisma.service';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';
export declare class SubscriptionRepository {
    private prisma;
    constructor(prisma: PrismaService);
    findByTenantId(tenantId: string): Promise<Subscription | null>;
    save(subscription: Subscription): Promise<void>;
}
//# sourceMappingURL=subscription.repository.d.ts.map