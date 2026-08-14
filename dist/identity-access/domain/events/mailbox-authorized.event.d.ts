export declare class MailboxAuthorizedEvent {
    readonly tenantId: string;
    readonly userId: string;
    readonly mailboxId: string;
    readonly platform: 'gmail' | 'outlook';
    readonly scopes: string[];
    readonly timestamp: Date;
    constructor(tenantId: string, userId: string, mailboxId: string, platform: 'gmail' | 'outlook', scopes: string[], timestamp?: Date);
}
//# sourceMappingURL=mailbox-authorized.event.d.ts.map