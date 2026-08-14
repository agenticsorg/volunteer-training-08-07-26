"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageMeterRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("@database/prisma.service");
const usage_meter_aggregate_1 = require("../../domain/aggregates/usage-meter.aggregate");
let UsageMeterRepository = class UsageMeterRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByTenantIdAndMeterType(tenantId, meterType) {
        const now = new Date();
        const meter = await this.prisma.usageMeter.findFirst({
            where: {
                tenantId,
                meterType,
                billingPeriodStart: { lte: now },
                billingPeriodEnd: { gte: now },
            },
        });
        if (!meter)
            return null;
        return new usage_meter_aggregate_1.UsageMeter(meter.id, meter.tenantId, meter.meterType, meter.billingPeriodStart, meter.billingPeriodEnd, meter.usageCount, meter.overageThreshold, meter.overageDetected, meter.lastIncrementedAt || undefined);
    }
    async atomicIncrement(tenantId, meterType, amount) {
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
        if (!meter)
            return null;
        // Atomic increment at database level
        const updated = await this.prisma.usageMeter.update({
            where: { id: meter.id },
            data: {
                usageCount: { increment: amount },
                lastIncrementedAt: now,
            },
        });
        return new usage_meter_aggregate_1.UsageMeter(updated.id, updated.tenantId, updated.meterType, updated.billingPeriodStart, updated.billingPeriodEnd, updated.usageCount, updated.overageThreshold, updated.overageDetected, updated.lastIncrementedAt || undefined);
    }
    async save(meter) {
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
};
exports.UsageMeterRepository = UsageMeterRepository;
exports.UsageMeterRepository = UsageMeterRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsageMeterRepository);
//# sourceMappingURL=usage-meter.repository.js.map