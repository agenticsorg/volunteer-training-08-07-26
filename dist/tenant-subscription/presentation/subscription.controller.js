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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const subscription_repository_1 = require("../infrastructure/repositories/subscription.repository");
const plan_catalog_repository_1 = require("../infrastructure/repositories/plan-catalog.repository");
const stripe_adapter_1 = require("../infrastructure/adapters/stripe.adapter");
const event_publisher_service_1 = require("../application/event-publisher.service");
const tenant_decorator_1 = require("@common/decorators/tenant.decorator");
let SubscriptionController = class SubscriptionController {
    constructor(subscriptionRepository, planRepository, billingAdapter, eventPublisher) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.billingAdapter = billingAdapter;
        this.eventPublisher = eventPublisher;
    }
    async getSubscription(tenantId, requestTenantId) {
        if (tenantId !== requestTenantId) {
            throw new Error('Tenant mismatch');
        }
        const subscription = await this.subscriptionRepository.findByTenantId(tenantId);
        if (!subscription) {
            return { error: 'No subscription found' };
        }
        const plan = await this.planRepository.findById(subscription.currentPlanId);
        return {
            subscription: {
                id: subscription.id,
                status: subscription.status,
                planVersion: subscription.planVersion,
            },
            plan: {
                id: plan?.id,
                name: plan?.name,
                mailboxLimit: plan?.mailboxLimit,
            },
        };
    }
    async changePlan(tenantId, { planId }, requestTenantId) {
        if (tenantId !== requestTenantId) {
            throw new Error('Tenant mismatch');
        }
        const subscription = await this.subscriptionRepository.findByTenantId(tenantId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }
        const newPlan = await this.planRepository.findById(planId);
        if (!newPlan) {
            throw new Error('Plan not found');
        }
        subscription.changePlan(planId, {
            mailboxLimit: newPlan.mailboxLimit,
            llmTierCeiling: newPlan.llmTierCeiling,
            features: newPlan.features,
        });
        await this.subscriptionRepository.save(subscription);
        await this.eventPublisher.publishEvents(subscription.getUncommittedEvents());
        subscription.clearUncommittedEvents();
        return { success: true };
    }
    async handleStripeWebhook(event) {
        await this.billingAdapter.handlePaymentWebhook(event);
        return { received: true };
    }
};
exports.SubscriptionController = SubscriptionController;
__decorate([
    (0, common_1.Get)(':tenantId'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, tenant_decorator_1.Tenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Post)(':tenantId/change-plan'),
    __param(0, (0, common_1.Param)('tenantId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, tenant_decorator_1.Tenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "changePlan", null);
__decorate([
    (0, common_1.Post)('webhooks/stripe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "handleStripeWebhook", null);
exports.SubscriptionController = SubscriptionController = __decorate([
    (0, common_1.Controller)('subscriptions'),
    __metadata("design:paramtypes", [subscription_repository_1.SubscriptionRepository,
        plan_catalog_repository_1.PlanCatalogRepository,
        stripe_adapter_1.StripeAdapter,
        event_publisher_service_1.EventPublisherService])
], SubscriptionController);
//# sourceMappingURL=subscription.controller.js.map