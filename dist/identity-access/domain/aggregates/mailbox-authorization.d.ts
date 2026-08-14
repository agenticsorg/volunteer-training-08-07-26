import { ScopeSet } from '../value-objects/scope-set';
export declare class MailboxAuthorization {
    readonly id: string;
    readonly tenantId: string;
    readonly userId: string;
    readonly mailboxId: string;
    readonly platform: 'gmail' | 'outlook';
    private scopeSet;
    readonly credentialHandle: string;
    readonly consentGrantedAt: Date;
    private status;
    private domainEvents;
    constructor(id: string, tenantId: string, userId: string, mailboxId: string, platform: 'gmail' | 'outlook', scopeSet: ScopeSet, credentialHandle: string, // opaque reference to vault, never raw token
    consentGrantedAt: Date, status?: 'active' | 'revoked' | 'expired');
    static create(tenantId: string, userId: string, mailboxId: string, platform: 'gmail' | 'outlook', scopes: string[], credentialHandle: string): MailboxAuthorization;
    getScopes(): string[];
    getStatus(): 'active' | 'revoked' | 'expired';
    revoke(reason: 'user_initiated' | 'admin_revoked' | 'tenant_suspended'): void;
    getDomainEvents(): any[];
    clearDomainEvents(): void;
}
//# sourceMappingURL=mailbox-authorization.d.ts.map