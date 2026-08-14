import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CorrectionRecord } from '../../domain/aggregates/correction-record.aggregate';

@Injectable()
export class CorrectionRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(aggregate: CorrectionRecord, tenantId: string): Promise<void> {
    const data = aggregate.toDb();

    const existing = await this.prisma.correctionRecord.findFirst({
      where: {
        tenant_id: tenantId,
        message_id: aggregate.messageId,
      },
    });

    if (existing) {
      await this.prisma.correctionRecord.update({
        where: { id: existing.id },
        data: {
          verdict: data.verdict,
          source: data.source,
          state: data.state,
        },
      });
    } else {
      await this.prisma.correctionRecord.create({
        data: {
          tenant_id: tenantId,
          message_id: aggregate.messageId,
          verdict: data.verdict,
          source: data.source,
          state: data.state,
        },
      });
    }
  }

  async findByMessageId(
    tenantId: string,
    messageId: string,
  ): Promise<CorrectionRecord | null> {
    const record = await this.prisma.correctionRecord.findFirst({
      where: {
        tenant_id: tenantId,
        message_id: messageId,
      },
    });

    return record ? CorrectionRecord.fromDb(record) : null;
  }

  async findCandidatesForCorroboration(
    tenantId: string,
    windowDays: number = 7,
  ): Promise<CorrectionRecord[]> {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const records = await this.prisma.correctionRecord.findMany({
      where: {
        tenant_id: tenantId,
        state: 'candidate',
        created_at: { gte: since },
      },
    });

    return records.map((r) => CorrectionRecord.fromDb(r));
  }
}
