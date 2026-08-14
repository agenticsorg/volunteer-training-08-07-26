export declare class MessageIngestedEvent {
    readonly messageId: string;
    readonly tenantId: string;
    readonly mailboxId: string;
    readonly platform: string;
    readonly normalizedEnvelope: Record<string, any>;
    readonly timestamp: Date;
    constructor(messageId: string, tenantId: string, mailboxId: string, platform: string, normalizedEnvelope: Record<string, any>, timestamp?: Date);
}
export declare class MailboxSyncFailedEvent {
    readonly tenantId: string;
    readonly mailboxId: string;
    readonly reason: string;
    readonly timestamp: Date;
    constructor(tenantId: string, mailboxId: string, reason: string, timestamp?: Date);
}
export declare class WatchSubscriptionExpiringEvent {
    readonly mailboxId: string;
    readonly platform: string;
    readonly timestamp: Date;
    constructor(mailboxId: string, platform: string, timestamp?: Date);
}
//# sourceMappingURL=message-ingested.event.d.ts.map