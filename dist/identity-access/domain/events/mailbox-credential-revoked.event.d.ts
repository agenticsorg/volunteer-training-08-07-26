export type RevocationReason = 'user_initiated' | 'admin_revoked' | 'platform_invalidated' | 'tenant_suspended' | 'expired';
export declare class MailboxCredentialRevokedEvent {
    readonly tenantId: string;
    readonly mailboxId: string;
    readonly platform: 'gmail' | 'outlook';
    readonly reason: RevocationReason;
    readonly timestamp: Date;
    constructor(tenantId: string, mailboxId: string, platform: 'gmail' | 'outlook', reason: RevocationReason, timestamp?: Date);
}
//# sourceMappingURL=mailbox-credential-revoked.event.d.ts.map