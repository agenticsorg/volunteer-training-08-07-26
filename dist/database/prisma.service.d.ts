import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class PrismaService implements OnModuleInit, OnModuleDestroy {
    private prisma;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    setTenantContext(tenantId: string): Promise<void>;
    getClient(): any;
}
//# sourceMappingURL=prisma.service.d.ts.map