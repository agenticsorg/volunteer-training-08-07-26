import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { UsageMeter } from '../../domain/aggregates/usage-meter.aggregate';

@Injectable()
export class UsageMeterRepository {
  constructor(private prisma: PrismaService) {}

  async findByTenantIdAndMeterType(tenantId: string, meterType: string): Promise<UsageMeter | null> {
    const now = new Date();
    const meter = await this.prisma.usageMeter.findFirst({
      where: {
        tenantId,
        meterType,
        billingPeriodStart: { lte: now },
        billingPeriodEnd: { gte: now },
      },
    });

    if (!meter) return null;

    return new UsageMeter(
      meter.id,
      meter.tenantId,
      meter.meterType,
      meter.billingPeriodStart,
      meter.billingPeriodEnd,
      meter.usageCount,
      meter.overageThreshold,
      meter.overageDetected,
      meter.lastIncrementedAt || undefined,
    );
  }

  async atomicIncrement(tenantId: string, meterType: string, amount: number): Promise<UsageMeter | null> {
    const now = new Date();

    // Find current billing period meter
    const meter = await this.prisma.usageMeter.findFirst({
      where: {
        tenantId,
        meterType,
        billingPeriodStart: { lte: now },
        billingPeriodEnd: { gte: now },
      },
    });

    if (!meter) return null;

    // Atomic increment at database level
    const updated = await this.prisma.usageMeter.update({
      where: { id: meter.id },
      data: {
        usageCount: { increment: amount },
        lastIncrementedAt: now,
      },
    });

    return new UsageMeter(
      updated.id,
      updated.tenantId,
      updated.meterType,
      updated.billingPeriodStart,
      updated.billingPeriodEnd,
      updated.usageCount,
      updated.overageThreshold,
      updated.overageDetected,
      updated.lastIncrementedAt || undefined,
    );
  }

  async save(meter: UsageMeter): Promise<void> {
    await this.prisma.usageMeter.upsert({
      where: {
        tenantId_meterType_billingPeriodStart_billingPeriodEnd: {
          tenantId: meter.tenantId,
          meterType: meter.meterType,
          billingPeriodStart: meter.billingPeriodStart,
          billingPeriodEnd: meter.billingPeriodEnd,
        },
      },
      create: {
        tenantId: meter.tenantId,
        meterType: meter.meterType,
        billingPeriodStart: meter.billingPeriodStart,
        billingPeriodEnd: meter.billingPeriodEnd,
        usageCount: meter.usageCount,
        overageThreshold: meter.overageThreshold,
        overageDetected: meter.overageDetected,
        lastIncrementedAt: meter.lastIncrementedAt,
      },
      update: {
        usageCount: meter.usageCount,
        overageDetected: meter.overageDetected,
        lastIncrementedAt: meter.lastIncrementedAt,
      },
    });
  }
}
