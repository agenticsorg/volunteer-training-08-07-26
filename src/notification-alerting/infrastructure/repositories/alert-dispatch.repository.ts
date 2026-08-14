import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AlertDispatch } from '../../domain/aggregates/alert-dispatch.aggregate';

@Injectable()
export class AlertDispatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(aggregate: AlertDispatch, tenantId: string): Promise<void> {
    const existing = await this.prisma.alertDispatch.findFirst({
      where: {
        id: aggregate.id,
      },
    });

    if (!existing) {
      await this.prisma.alertDispatch.create({
        data: {
          tenant_id: tenantId,
          user_id: aggregate.userId,
          alert_id: aggregate.id,
          category: aggregate.eventType,
          dispatched_at: aggregate.dispatchedAt,
          cool_down_until: aggregate.coolDownUntil,
        },
      });
    }
  }

  async findById(alertId: string): Promise<AlertDispatch | null> {
    const record = await this.prisma.alertDispatch.findFirst({
      where: { id: alertId },
    });

    return record ? AlertDispatch.fromDb(record) : null;
  }

  async findRecentAlertsInCoolDown(
    tenantId: string,
    userId: string,
    eventType: string,
    coolDownUntil: Date,
  ): Promise<AlertDispatch[]> {
    const records = await this.prisma.alertDispatch.findMany({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        category: eventType,
        cool_down_until: { gte: new Date() },
      },
    });

    return records.map((r) => AlertDispatch.fromDb(r));
  }
}
