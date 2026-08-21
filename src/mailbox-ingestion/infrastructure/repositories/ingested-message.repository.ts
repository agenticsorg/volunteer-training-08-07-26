import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { runInTenantTransaction } from '../../../database/tenant-transaction';
import { MessageEnvelope } from '../../domain/value-objects/message-envelope';
import { OutboxEventInput } from './mailbox-connection.repository';

export interface IngestedMessageData {
  id?: string;
  tenantId: string;
  messageId: string;
  mailboxId: string;
  mailboxConnectionId?: string | null;
  platformMessageId: string;
  platform: string;
  normalizedEnvelope: MessageEnvelope;
  bodyRefId?: string | null;
}

@Injectable()
export class IngestedMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlatformMessageId(tenantId: string, platformMessageId: string, platform: string, mailboxId: string) {
    return runInTenantTransaction(this.prisma, tenantId, (tx) =>
      tx.ingestedMessage.findUnique({
        where: {
          tenantId_platformMessageId_platform_mailboxId: { tenantId, platformMessageId, platform, mailboxId },
        },
      }),
    );
  }

  async findById(tenantId: string, id: string) {
    return runInTenantTransaction(this.prisma, tenantId, (tx) => tx.ingestedMessage.findUnique({ where: { id } }));
  }

  /**
   * Idempotent per (tenantId, platformMessageId, platform, mailboxId) — a
   * redelivered webhook or an overlapping reconciliation sweep resolves to
   * the same row rather than a duplicate (ADR 0004/0023), matching the
   * unique constraint already on `ingested_messages`. When `events` is
   * given (e.g. MessageIngestedEvent on first insert), its outbox row is
   * written in the same transaction as the message row — but only on
   * genuine first-insert; a duplicate delivery must not re-publish the
   * event a second time.
   */
  async save(data: IngestedMessageData, events: OutboxEventInput[] = []) {
    return runInTenantTransaction(this.prisma, data.tenantId, async (tx) => {
      const existing = await tx.ingestedMessage.findUnique({
        where: {
          tenantId_platformMessageId_platform_mailboxId: {
            tenantId: data.tenantId,
            platformMessageId: data.platformMessageId,
            platform: data.platform,
            mailboxId: data.mailboxId,
          },
        },
      });
      if (existing) {
        return existing;
      }

      const saved = await tx.ingestedMessage.create({
        data: {
          tenantId: data.tenantId,
          messageId: data.messageId,
          mailboxId: data.mailboxId,
          mailboxConnectionId: data.mailboxConnectionId ?? null,
          platformMessageId: data.platformMessageId,
          platform: data.platform,
          normalizedEnvelope: data.normalizedEnvelope as unknown as Prisma.InputJsonValue,
          bodyRefId: data.bodyRefId ?? null,
        },
      });

      for (const event of events) {
        await tx.domainEventOutbox.create({
          data: {
            tenantId: data.tenantId,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
          },
        });
      }

      return saved;
    });
  }
}
