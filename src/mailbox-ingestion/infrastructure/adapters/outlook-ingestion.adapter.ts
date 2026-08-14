import { Injectable } from '@nestjs/common';
import { MessageEnvelope, MessageEnvelopeFactory } from '../../domain/value-objects';
import { MailboxSyncPort } from './mailbox-sync.port';

@Injectable()
export class OutlookIngestionAdapter implements MailboxSyncPort {
  async establishWatch(mailboxId: string, accessToken: string): Promise<{ subscriptionId: string; expiresAt: Date }> {
    return {
      subscriptionId: `outlook-sub-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    };
  }
  
  async renewWatch(mailboxId: string, subscriptionId: string, accessToken: string): Promise<{ expiresAt: Date }> {
    return {
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    };
  }
  
  async pullDelta(mailboxId: string, accessToken: string, cursorValue: string): Promise<{ messages: string[]; newCursor: string }> {
    return {
      messages: [],
      newCursor: `deltaLink-${Date.now()}`,
    };
  }
  
  async fetchMessage(mailboxId: string, messageId: string, accessToken: string): Promise<MessageEnvelope> {
    return MessageEnvelopeFactory.create({
      messageId,
      from: 'sender@example.com',
      to: [mailboxId],
      subject: 'Test Message',
      platform: 'outlook',
      sentAt: new Date().toISOString(),
    });
  }
}
