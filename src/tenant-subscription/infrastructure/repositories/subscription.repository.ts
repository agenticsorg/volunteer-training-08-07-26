import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';

@Injectable()
export class SubscriptionRepository {
  constructor(private prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) return null;

    return new Subscription(
      subscription.id,
      subscription.tenantId,
      subscription.currentPlanId,
      subscription.status as any,
      subscription.planVersion,
      subscription.planChangedAt || undefined,
      subscription.stripeCustomerId || undefined,
      subscription.stripeSubscriptionId || undefined,
    );
  }

  async save(subscription: Subscription): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { tenantId: subscription.tenantId },
      create: {
        tenantId: subscription.tenantId,
        currentPlanId: subscription.currentPlanId,
        status: subscription.status,
        planVersion: subscription.planVersion,
        planChangedAt: subscription.planChangedAt,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
      update: {
        currentPlanId: subscription.currentPlanId,
        status: subscription.status,
        planVersion: subscription.planVersion,
        planChangedAt: subscription.planChangedAt,
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
    });
  }
}
