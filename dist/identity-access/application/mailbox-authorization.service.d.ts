import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailboxAuthorization } from '../domain/aggregates/mailbox-authorization';
import { MailboxAuthorizationRepository } from '../infrastructure/repositories/mailbox-authorization.repository';
import { OAuthProviderPort } from '../domain/ports/oauth-provider.port';
export declare class MailboxAuthorizationService {
    private repository;
    private googleOAuth;
    private microsoftOAuth;
    private eventEmitter;
    constructor(repository: MailboxAuthorizationRepository, googleOAuth: OAuthProviderPort, microsoftOAuth: OAuthProviderPort, eventEmitter: EventEmitter2);
    grantConsent(tenantId: string, userId: string, mailboxId: string, platform: 'gmail' | 'outlook', scopes: string[], credentialHandle: string): Promise<MailboxAuthorization>;
    refreshToken(tenantId: string, mailboxId: string): Promise<void>;
    revoke(tenantId: string, mailboxId: string, reason: 'user_initiated' | 'admin_revoked' | 'tenant_suspended'): Promise<void>;
    revokeAllForTenant(tenantId: string): Promise<void>;
}
//# sourceMappingURL=mailbox-authorization.service.d.ts.map