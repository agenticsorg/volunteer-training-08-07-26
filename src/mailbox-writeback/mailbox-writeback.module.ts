import { Module } from '@nestjs/common';
import { MessageWriteBackService } from './application/services/message-writeback.service';
import { MessageWriteBackStateRepository } from './infrastructure/repositories/message-writeback-state.repository';
import { GmailWriteBackAdapter } from './infrastructure/adapters/gmail-writeback.adapter';
import { OutlookWriteBackAdapter } from './infrastructure/adapters/outlook-writeback.adapter';
import { PrismaService } from '../database/prisma.service';

@Module({
  providers: [
    PrismaService,
    MessageWriteBackService,
    MessageWriteBackStateRepository,
    GmailWriteBackAdapter,
    OutlookWriteBackAdapter,
    {
      provide: 'GMAIL_WRITE_PORT',
      useExisting: GmailWriteBackAdapter,
    },
    {
      provide: 'OUTLOOK_WRITE_PORT',
      useExisting: OutlookWriteBackAdapter,
    },
  ],
  exports: [
    MessageWriteBackService,
    MessageWriteBackStateRepository,
    GmailWriteBackAdapter,
    OutlookWriteBackAdapter,
  ],
})
export class MailboxWritebackModule {}
