import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SenderReputationCache } from '../../domain/aggregates/sender-reputation-cache.aggregate';

@Injectable()
export class SenderReputationCacheRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    aggregate: SenderReputationCache,
    tenantId: string,
  ): Promise<void> {
    const data = aggregate.toDb();

    const existing = await this.prisma.senderReputationCache.findFirst({
      where: {
        tenant_id: tenantId,
        sender_domain: aggregate.senderDomain,
      },
    });

    if (existing) {
      await this.prisma.senderReputationCache.update({
        where: { id: existing.id },
        data: {
          category_confidence: data.category_confidence,
          last_updated: data.last_updated,
        },
      });
    } else {
      await this.prisma.senderReputationCache.create({
        data: {
          tenant_id: tenantId,
          sender_domain: aggregate.senderDomain,
          category_confidence: data.category_confidence,
        },
      });
    }
  }

  async findBySenderDomain(
    tenantId: string,
    senderDomain: string,
  ): Promise<SenderReputationCache | null> {
    const record = await this.prisma.senderReputationCache.findFirst({
      where: {
        tenant_id: tenantId,
        sender_domain: senderDomain,
      },
    });

    return record ? SenderReputationCache.fromDb(record) : null;
  }

  async findOrCreate(
    tenantId: string,
    senderDomain: string,
  ): Promise<SenderReputationCache> {
    const existing = await this.findBySenderDomain(tenantId, senderDomain);
    if (existing) return existing;

    const agg = SenderReputationCache.create(tenantId, senderDomain);
    await this.save(agg, tenantId);
    return agg;
  }
}
