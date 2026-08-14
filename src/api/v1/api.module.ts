import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessagesController } from './controllers/messages.controller';
import { MailboxController } from './controllers/mailbox.controller';
import { TenantConfigController } from './controllers/tenant-config.controller';
import { BillingController } from './controllers/billing.controller';

@Module({
  controllers: [
    MessagesController,
    MailboxController,
    TenantConfigController,
    BillingController,
  ],
  providers: [PrismaService],
})
export class ApiV1Module {}
