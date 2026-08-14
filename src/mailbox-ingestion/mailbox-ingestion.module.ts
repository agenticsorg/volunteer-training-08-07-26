import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../database/database.module';
import { WebhooksController } from './presentation/webhooks.controller';
import { MailboxConnectionRepository } from './infrastructure/repositories/mailbox-connection.repository';
import { IngestedMessageRepository } from './infrastructure/repositories/ingested-message.repository';
import { GmailIngestionAdapter } from './infrastructure/adapters/gmail-ingestion.adapter';
import { OutlookIngestionAdapter } from './infrastructure/adapters/outlook-ingestion.adapter';
import { RateLimiterAdapter } from './infrastructure/adapters/rate-limiter.adapter';
import { WebhookWorker } from './infrastructure/queue/webhook.worker';
import { MessageEnvelopeFactory } from './domain/value-objects/message-envelope';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [WebhooksController],
  providers: [
    MailboxConnectionRepository,
    IngestedMessageRepository,
    GmailIngestionAdapter,
    OutlookIngestionAdapter,
    RateLimiterAdapter,
    WebhookWorker,
    MessageEnvelopeFactory,
    {
      provide: 'GMAIL_INGESTION_ADAPTER',
      useClass: GmailIngestionAdapter,
    },
    {
      provide: 'OUTLOOK_INGESTION_ADAPTER',
      useClass: OutlookIngestionAdapter,
    },
    {
      provide: 'RATE_LIMITER',
      useClass: RateLimiterAdapter,
    },
  ],
  exports: [
    MailboxConnectionRepository,
    IngestedMessageRepository,
    GmailIngestionAdapter,
    OutlookIngestionAdapter,
    RateLimiterAdapter,
  ],
})
export class MailboxIngestionModule {}
