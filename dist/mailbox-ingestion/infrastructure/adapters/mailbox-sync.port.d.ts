import { MessageEnvelope } from '../../domain/value-objects';
export interface MailboxSyncPort {
    establishWatch(mailboxId: string, accessToken: string): Promise<{
        subscriptionId: string;
        expiresAt: Date;
    }>;
    renewWatch(mailboxId: string, subscriptionId: string, accessToken: string): Promise<{
        expiresAt: Date;
    }>;
    pullDelta(mailboxId: string, accessToken: string, cursorValue: string): Promise<{
        messages: string[];
        newCursor: string;
    }>;
    fetchMessage(mailboxId: string, messageId: string, accessToken: string): Promise<MessageEnvelope>;
}
export interface RateLimiterPort {
    enforceQuota(platform: string, tenantId: string, mailboxId: string, units: number): Promise<boolean>;
    getCurrentUsage(platform: string, tenantId: string, mailboxId: string): Promise<number>;
}
export interface MessageBodyStorePort {
    store(tenantId: string, messageId: string, body: string, ttlMinutes: number): Promise<string>;
    retrieve(storageRef: string): Promise<string>;
    cleanup(tenantId: string, messageId: string): Promise<void>;
}
//# sourceMappingURL=mailbox-sync.port.d.ts.map