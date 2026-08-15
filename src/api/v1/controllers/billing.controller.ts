import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiTenantScopeGuard } from '../guards/api-tenant-scope.guard';
import { BillingInfoResponseDto } from '../dtos/billing.dto';

@Controller('v1/billing/:tenantId')
@UseGuards(ApiKeyGuard, ApiTenantScopeGuard)
export class BillingController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getBillingInfo(@Param('tenantId') tenantId: string): Promise<BillingInfoResponseDto> {
    const [subscription, usageMeters] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { tenantId },
        include: { currentPlan: true },
      }),
      this.prisma.usageMeter.findMany({
        where: { tenantId },
      }),
    ]);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      subscription: {
        id: subscription.id,
        tenant_id: subscription.tenantId,
        status: subscription.status,
        current_plan: {
          id: subscription.currentPlan.id,
          name: subscription.currentPlan.name,
          mailbox_limit: subscription.currentPlan.mailboxLimit,
          llm_tier_ceiling: subscription.currentPlan.llmTierCeiling,
          features: (subscription.currentPlan.features || {}) as Record<string, any>,
        },
        plan_version: subscription.planVersion,
        plan_changed_at: subscription.planChangedAt?.toISOString(),
        created_at: subscription.createdAt?.toISOString(),
        updated_at: subscription.updatedAt?.toISOString(),
      },
      usage_meters: usageMeters.map((meter) => ({
        meter_type: meter.meterType,
        usage_count: Number(meter.usageCount),
        overage_threshold: Number(meter.overageThreshold),
        overage_detected: meter.overageDetected,
        billing_period_start: meter.billingPeriodStart?.toISOString(),
        billing_period_end: meter.billingPeriodEnd?.toISOString(),
        last_incremented_at: meter.lastIncrementedAt?.toISOString(),
      })),
      current_period_cost: 0,
      estimated_overage_cost: 0,
    };
  }

  @Get('usage/:meterType')
  async getUsageForMeter(
    @Param('tenantId') tenantId: string,
    @Param('meterType') meterType: string,
  ): Promise<any> {
    const meter = await this.prisma.usageMeter.findFirst({
      where: {
        tenantId,
        meterType,
      },
      orderBy: { billingPeriodStart: 'desc' },
    });

    if (!meter) {
      return { error: 'Usage meter not found' };
    }

    return {
      meter_type: meter.meterType,
      usage_count: Number(meter.usageCount),
      overage_threshold: Number(meter.overageThreshold),
      overage_detected: meter.overageDetected,
      billing_period_start: meter.billingPeriodStart?.toISOString(),
      billing_period_end: meter.billingPeriodEnd?.toISOString(),
    };
  }
}
