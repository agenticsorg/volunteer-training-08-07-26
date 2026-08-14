import { PrismaClient } from '@prisma/client';
import { MailboxAuthorization } from '../../domain/aggregates/mailbox-authorization';
export declare class MailboxAuthorizationRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    save(tenantId: string, auth: MailboxAuthorization): Promise<void>;
    findByTenantIdAndMailboxId(tenantId: string, mailboxId: string): Promise<MailboxAuthorization | null>;
    findByTenantId(tenantId: string): Promise<MailboxAuthorization[]>;
    revokeAllForTenant(tenantId: string): Promise<void>;
}
//# sourceMappingURL=mailbox-authorization.repository.d.ts.map