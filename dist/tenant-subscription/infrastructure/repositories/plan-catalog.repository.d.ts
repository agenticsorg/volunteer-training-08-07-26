import { PrismaService } from '@database/prisma.service';
export declare class PlanCatalogRepository {
    private prisma;
    constructor(prisma: PrismaService);
    listActivePlans(): Promise<{
        active: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stripePriceId: string;
        mailboxLimit: number;
        llmTierCeiling: string;
        features: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    findById(planId: string): Promise<{
        active: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stripePriceId: string;
        mailboxLimit: number;
        llmTierCeiling: string;
        features: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    findByStripePriceId(stripePriceId: string): Promise<{
        active: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stripePriceId: string;
        mailboxLimit: number;
        llmTierCeiling: string;
        features: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
}
//# sourceMappingURL=plan-catalog.repository.d.ts.map