import { PrismaService } from '@database/prisma.service';
import { UsageMeter } from '../../domain/aggregates/usage-meter.aggregate';
export declare class UsageMeterRepository {
    private prisma;
    constructor(prisma: PrismaService);
    findByTenantIdAndMeterType(tenantId: string, meterType: string): Promise<UsageMeter | null>;
    atomicIncrement(tenantId: string, meterType: string, amount: number): Promise<UsageMeter | null>;
    save(meter: UsageMeter): Promise<void>;
}
//# sourceMappingURL=usage-meter.repository.d.ts.map