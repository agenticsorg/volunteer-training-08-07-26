export interface MessageEnvelope {
    messageId: string;
    threadRef?: string;
    platform: 'gmail' | 'outlook';
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    sentAt: string;
    hasCalendarPart?: boolean;
    calendarMethodType?: 'REQUEST' | 'REPLY' | 'CANCEL' | 'REFRESH' | 'COUNTER' | 'DECLINECOUNTER';
    listUnsubscribe?: string;
    listId?: string;
    precedence?: string;
    autoSubmitted?: string;
    spfPass?: boolean;
    dkimPass?: boolean;
    dmarcPass?: boolean;
    attachmentSummaries?: Array<{
        filename: string;
        mimeType: string;
        sizeBytes?: number;
    }>;
}
export declare class MessageEnvelopeFactory {
    static create(data: Partial<MessageEnvelope>): MessageEnvelope;
    static validate(envelope: MessageEnvelope): MessageEnvelope;
}
export declare const MessageEnvelopeSchema: {};
//# sourceMappingURL=message-envelope.d.ts.map