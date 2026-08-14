import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MessageWriteBackState } from '../../domain/aggregates/message-writeback-state.aggregate';

@Injectable()
export class MessageWriteBackStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    aggregate: MessageWriteBackState,
    tenantId: string,
  ): Promise<void> {
    const facetsDb = aggregate.toDb();

    // Use findFirst + upsert pattern since Prisma hasn't yet indexed the composite unique
    const existing = await this.prisma.messageWriteBackState.findFirst({
      where: {
        tenant_id: tenantId,
        mailbox_id: aggregate.mailboxId,
        message_id: aggregate.messageId,
      },
    });

    if (existing) {
      await this.prisma.messageWriteBackState.update({
        where: { id: existing.id },
        data: { facets: facetsDb },
      });
    } else {
      await this.prisma.messageWriteBackState.create({
        data: {
          tenant_id: tenantId,
          mailbox_id: aggregate.mailboxId,
          message_id: aggregate.messageId,
          facets: facetsDb,
        },
      });
    }
  }

  async findByMessageId(
    tenantId: string,
    mailboxId: string,
    messageId: string,
  ): Promise<MessageWriteBackState | null> {
    const record = await this.prisma.messageWriteBackState.findFirst({
      where: {
        tenant_id: tenantId,
        mailbox_id: mailboxId,
        message_id: messageId,
      },
    });

    if (!record) return null;

    return new MessageWriteBackState(
      record.tenant_id,
      record.mailbox_id,
      record.message_id,
      record.facets as Record<string, any>,
    );
  }

  async findOrCreateByMessageId(
    tenantId: string,
    mailboxId: string,
    messageId: string,
  ): Promise<MessageWriteBackState> {
    const existing = await this.findByMessageId(tenantId, mailboxId, messageId);
    if (existing) return existing;

    const agg = MessageWriteBackState.create(tenantId, mailboxId, messageId);
    await this.save(agg, tenantId);
    return agg;
  }
}
