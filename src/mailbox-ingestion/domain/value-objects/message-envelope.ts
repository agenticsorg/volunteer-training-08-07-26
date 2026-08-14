export interface MessageEnvelope {
  messageId: string;
  threadRef?: string;
  platform: 'gmail' | 'outlook';
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  sentAt: string; // ISO 8601
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

export class MessageEnvelopeFactory {
  static create(data: Partial<MessageEnvelope>): MessageEnvelope {
    if (!data.messageId || !data.from || !data.to || !data.platform || !data.sentAt) {
      throw new Error('MessageEnvelope missing required fields');
    }
    return {
      messageId: data.messageId,
      threadRef: data.threadRef,
      platform: data.platform,
      from: data.from,
      to: data.to,
      cc: data.cc || [],
      bcc: data.bcc || [],
      subject: data.subject || '',
      sentAt: data.sentAt,
      hasCalendarPart: data.hasCalendarPart || false,
      calendarMethodType: data.calendarMethodType,
      listUnsubscribe: data.listUnsubscribe,
      listId: data.listId,
      precedence: data.precedence,
      autoSubmitted: data.autoSubmitted,
      spfPass: data.spfPass,
      dkimPass: data.dkimPass,
      dmarcPass: data.dmarcPass,
      attachmentSummaries: data.attachmentSummaries || [],
    };
  }
  
  static validate(envelope: MessageEnvelope): MessageEnvelope {
    return MessageEnvelopeFactory.create(envelope);
  }
}

export const MessageEnvelopeSchema = {};
