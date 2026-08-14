import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationSubscription } from '../../domain/aggregates/notification-subscription.aggregate';

@Injectable()
export class NotificationSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    aggregate: NotificationSubscription,
    tenantId: string,
  ): Promise<void> {
    const data = aggregate.toDb();

    const existing = await this.prisma.notificationSubscription.findFirst({
      where: {
        tenant_id: tenantId,
        user_id: aggregate.userId,
      },
    });

    if (existing) {
      await this.prisma.notificationSubscription.update({
        where: { id: existing.id },
        data: {
          preferences: data.preferences,
          authorized_channels: data.authorized_channels,
        },
      });
    } else {
      await this.prisma.notificationSubscription.create({
        data: {
          tenant_id: tenantId,
          user_id: aggregate.userId,
          preferences: data.preferences,
          authorized_channels: data.authorized_channels,
        },
      });
    }
  }

  async findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<NotificationSubscription | null> {
    const record = await this.prisma.notificationSubscription.findFirst({
      where: {
        tenant_id: tenantId,
        user_id: userId,
      },
    });

    return record ? NotificationSubscription.fromDb(record) : null;
  }

  async findOrCreate(
    tenantId: string,
    userId: string,
  ): Promise<NotificationSubscription> {
    const existing = await this.findByUserId(tenantId, userId);
    if (existing) return existing;

    const agg = NotificationSubscription.create(tenantId, userId);
    await this.save(agg, tenantId);
    return agg;
  }
}
