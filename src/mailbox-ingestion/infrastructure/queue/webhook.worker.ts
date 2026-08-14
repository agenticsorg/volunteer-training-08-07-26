import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailboxConnectionRepository, IngestedMessageRepository } from '../repositories';
import { MessageIngestedEvent } from '../../domain/events/message-ingested.event';
import { Logger } from '@nestjs/common';

@Injectable()
export class WebhookWorker {
  private logger = new Logger('WebhookWorker');
  
  constructor(
    private mailboxRepo: MailboxConnectionRepository,
    private messageRepo: IngestedMessageRepository,
    private eventEmitter: EventEmitter2,
  ) {}
  
  async handleWebhook(tenantId: string, mailboxId: string, platform: string): Promise<void> {
    this.logger.debug(`Webhook received: ${platform}/${mailboxId}`);
    
    const connection = await this.mailboxRepo.findByTenantIdAndMailboxId(tenantId, mailboxId, platform);
    if (!connection) {
      this.logger.warn(`Connection not found: ${tenantId}/${mailboxId}/${platform}`);
      return;
    }
    
    // Enqueue delta-sync job (webhook payload is never trusted as complete per ADR 0004)
    this.eventEmitter.emit('mailbox.delta-sync-requested', {
      tenantId,
      mailboxConnectionId: connection.id,
    });
  }
}
