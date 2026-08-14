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
exports.SubscriptionRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("@database/prisma.service");
const subscription_aggregate_1 = require("../../domain/aggregates/subscription.aggregate");
let SubscriptionRepository = class SubscriptionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByTenantId(tenantId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { tenantId },
        });
        if (!subscription)
            return null;
        return new subscription_aggregate_1.Subscription(subscription.id, subscription.tenantId, subscription.currentPlanId, subscription.status, subscription.planVersion, subscription.planChangedAt || undefined, subscription.stripeCustomerId || undefined, subscription.stripeSubscriptionId || undefined);
    }
    async save(subscription) {
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
};
exports.SubscriptionRepository = SubscriptionRepository;
exports.SubscriptionRepository = SubscriptionRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionRepository);
//# sourceMappingURL=subscription.repository.js.map