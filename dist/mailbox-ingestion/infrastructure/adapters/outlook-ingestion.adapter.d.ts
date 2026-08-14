import { MessageEnvelope } from '../../domain/value-objects';
import { MailboxSyncPort } from './mailbox-sync.port';
export declare class OutlookIngestionAdapter implements MailboxSyncPort {
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
//# sourceMappingURL=outlook-ingestion.adapter.d.ts.map