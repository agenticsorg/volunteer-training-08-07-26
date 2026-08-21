import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { runInTenantTransaction } from '../../../database/tenant-transaction';

export interface MailboxConnectionData {
  id?: string;
  tenantId: string;
  mailboxId: string;
  platform: string;
  status?: string;
  watchSubscriptionId?: string | null;
  watchExpiresAt?: Date | null;
  syncCursorValue?: string | null;
  credentialHandleId: string;
  lastWebhookAt?: Date | null;
  lastSyncAt?: Date | null;
  syncFailureCount?: number;
}

export interface OutboxEventInput {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class MailboxConnectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // RLS ("domain_event_outbox_tenant_isolation"-style policies, see the RLS
  // migration) requires row_security_context.tenant_id to be set for *every*
  // query against this table, reads included — so every method here runs
  // inside runInTenantTransaction rather than only the write path.

  async findByTenantIdAndMailboxId(tenantId: string, mailboxId: string, platform: string) {
    return runInTenantTransaction(this.prisma, tenantId, (tx) =>
      tx.mailboxConnection.findUnique({
        where: { tenantId_mailboxId_platform: { tenantId, mailboxId, platform } },
      }),
    );
  }

  async updateSyncCursor(tenantId: string, id: string, cursorValue: string) {
    return runInTenantTransaction(this.prisma, tenantId, (tx) =>
      tx.mailboxConnection.update({
        where: { id },
        data: { syncCursorValue: cursorValue, lastSyncAt: new Date() },
      }),
    );
  }

  async incrementFailureCount(tenantId: string, id: string) {
    return runInTenantTransaction(this.prisma, tenantId, (tx) =>
      tx.mailboxConnection.update({
        where: { id },
        data: { syncFailureCount: { increment: 1 } },
      }),
    );
  }

  /**
   * Upserts the connection row and, when `events` is given, writes the
   * corresponding domain_event_outbox row(s) in the same transaction (ADR
   * 0023) — the connection state change and its published events either both
   * commit or neither does.
   */
  async save(data: MailboxConnectionData, events: OutboxEventInput[] = []) {
    return runInTenantTransaction(this.prisma, data.tenantId, async (tx) => {
      const saved = await tx.mailboxConnection.upsert({
        where: { tenantId_mailboxId_platform: { tenantId: data.tenantId, mailboxId: data.mailboxId, platform: data.platform } },
        create: {
          tenantId: data.tenantId,
          mailboxId: data.mailboxId,
          platform: data.platform,
          status: data.status ?? 'active',
          watchSubscriptionId: data.watchSubscriptionId ?? null,
          watchExpiresAt: data.watchExpiresAt ?? null,
          syncCursorValue: data.syncCursorValue ?? null,
          credentialHandleId: data.credentialHandleId,
          lastWebhookAt: data.lastWebhookAt ?? null,
          lastSyncAt: data.lastSyncAt ?? null,
          syncFailureCount: data.syncFailureCount ?? 0,
        },
        update: {
          status: data.status ?? 'active',
          watchSubscriptionId: data.watchSubscriptionId ?? null,
          watchExpiresAt: data.watchExpiresAt ?? null,
          syncCursorValue: data.syncCursorValue ?? null,
          credentialHandleId: data.credentialHandleId,
          lastWebhookAt: data.lastWebhookAt ?? null,
          lastSyncAt: data.lastSyncAt ?? null,
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
