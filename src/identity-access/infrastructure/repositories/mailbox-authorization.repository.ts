import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MailboxAuthorization } from '../../domain/aggregates/mailbox-authorization';
import { ScopeSet } from '../../domain/value-objects/scope-set';

@Injectable()
export class MailboxAuthorizationRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    tenantId: string,
    auth: MailboxAuthorization,
  ): Promise<void> {
    const events = auth.getDomainEvents();

    await this.prisma.mailboxAuthorization.upsert({
      where: {
        tenantId_userId_mailboxId_platform: {
          tenantId,
          userId: auth.userId,
          mailboxId: auth.mailboxId,
          platform: auth.platform,
        },
      },
      update: {
        status: auth.getStatus(),
        lastTokenRefreshedAt: new Date(),
      },
      create: {
        tenantId,
        userId: auth.userId,
        mailboxId: auth.mailboxId,
        platform: auth.platform,
        scopeSet: auth.getScopes(),
        consentGrantedAt: auth.consentGrantedAt,
        credentialHandle: auth.credentialHandle,
        status: 'active',
      },
    });

    // Store consent grant
    if (events.length > 0) {
      const consentGrant = events.find(
        (e) => e.constructor.name === 'MailboxAuthorizedEvent',
      );
      if (consentGrant) {
        const dbAuth = await this.prisma.mailboxAuthorization.findUnique({
          where: {
            tenantId_userId_mailboxId_platform: {
              tenantId,
              userId: auth.userId,
              mailboxId: auth.mailboxId,
              platform: auth.platform,
            },
          },
        });

        if (dbAuth) {
          await this.prisma.consentGrant.create({
            data: {
              mailboxAuthorizationId: dbAuth.id,
              scopeSet: consentGrant.scopes,
              grantedAt: new Date(),
            },
          });
        }
      }
    }

    auth.clearDomainEvents();
  }

  async findByTenantIdAndMailboxId(
    tenantId: string,
    mailboxId: string,
  ): Promise<MailboxAuthorization | null> {
    const record = await this.prisma.mailboxAuthorization.findFirst({
      where: { tenantId, mailboxId },
    });

    if (!record) return null;

    const scopeSet =
      record.platform === 'gmail'
        ? ScopeSet.forGmail(record.scopeSet as string[])
        : ScopeSet.forOutlook(record.scopeSet as string[]);

    return new MailboxAuthorization(
      record.id,
      record.tenantId,
      record.userId,
      record.mailboxId,
      record.platform as 'gmail' | 'outlook',
      scopeSet,
      record.credentialHandle,
      record.consentGrantedAt,
      record.status as 'active' | 'revoked' | 'expired',
    );
  }

  async findByTenantId(tenantId: string): Promise<MailboxAuthorization[]> {
    const records = await this.prisma.mailboxAuthorization.findMany({
      where: { tenantId, status: 'active' },
    });

    return records.map((record) => {
      const scopeSet =
        record.platform === 'gmail'
          ? ScopeSet.forGmail(record.scopeSet as string[])
          : ScopeSet.forOutlook(record.scopeSet as string[]);

      return new MailboxAuthorization(
        record.id,
        record.tenantId,
        record.userId,
        record.mailboxId,
        record.platform as 'gmail' | 'outlook',
        scopeSet,
        record.credentialHandle,
        record.consentGrantedAt,
        record.status as 'active' | 'revoked' | 'expired',
      );
    });
  }

  async revokeAllForTenant(tenantId: string): Promise<void> {
    await this.prisma.mailboxAuthorization.updateMany({
      where: { tenantId, status: 'active' },
      data: { status: 'revoked', updatedAt: new Date() },
    });
  }
}
