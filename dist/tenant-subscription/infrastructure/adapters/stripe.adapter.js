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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeAdapter = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = __importDefault(require("stripe"));
const plan_catalog_repository_1 = require("../repositories/plan-catalog.repository");
const subscription_repository_1 = require("../repositories/subscription.repository");
let StripeAdapter = class StripeAdapter {
    constructor(planRepository, subscriptionRepository) {
        this.planRepository = planRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.logger = new common_1.Logger('StripeAdapter');
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (!apiKey) {
            this.logger.warn('STRIPE_SECRET_KEY not set - billing provider disabled');
            this.stripe = null;
        }
        else {
            this.stripe = new stripe_1.default(apiKey, { apiVersion: '2023-10-16' });
        }
    }
    async createSubscription(tenantId, planId) {
        const plan = await this.planRepository.findById(planId);
        if (!plan)
            throw new Error(`Plan ${planId} not found`);
        if (!this.stripe) {
            return { customerId: `test-customer-${tenantId}`, subscriptionId: `test-sub-${tenantId}` };
        }
        const customer = await this.stripe.customers.create({
            metadata: { tenantId },
        });
        const subscription = await this.stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: plan.stripePriceId }],
        });
        return { customerId: customer.id, subscriptionId: subscription.id };
    }
    async changePlan(subscriptionId, newPriceId) {
        if (!this.stripe) {
            this.logger.log(`Mock plan change for subscription ${subscriptionId}`);
            return;
        }
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        const itemId = subscription.items.data[0].id;
        await this.stripe.subscriptionItems.update(itemId, { price: newPriceId });
    }
    async recordUsageCharge(subscriptionId, usageAmount) {
        if (!this.stripe) {
            this.logger.log(`Mock usage charge ${usageAmount} for subscription ${subscriptionId}`);
            return;
        }
        // Stripe usage-based billing is handled via subscriptionItems
        // This would be called for per-unit charges
    }
    async handlePaymentWebhook(event) {
        if (!event || !event.data)
            return;
        const { type, data } = event;
        if (type === 'invoice.payment_failed') {
            const invoice = data.object;
            const customerId = invoice.customer;
            // Find subscription by Stripe customer ID and mark as past due
            const subscriptions = await this.subscriptionRepository.findByTenantId(customerId);
            if (subscriptions) {
                subscriptions.markPastDue();
                await this.subscriptionRepository.save(subscriptions);
            }
        }
    }
};
exports.StripeAdapter = StripeAdapter;
exports.StripeAdapter = StripeAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plan_catalog_repository_1.PlanCatalogRepository,
        subscription_repository_1.SubscriptionRepository])
], StripeAdapter);
//# sourceMappingURL=stripe.adapter.js.map