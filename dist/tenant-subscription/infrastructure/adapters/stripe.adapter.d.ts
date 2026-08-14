import { BillingProviderPort } from './billing-provider.port';
import { PlanCatalogRepository } from '../repositories/plan-catalog.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
export declare class StripeAdapter implements BillingProviderPort {
    private planRepository;
    private subscriptionRepository;
    private stripe;
    private logger;
    constructor(planRepository: PlanCatalogRepository, subscriptionRepository: SubscriptionRepository);
    createSubscription(tenantId: string, planId: string): Promise<{
        customerId: string;
        subscriptionId: string;
    }>;
    changePlan(subscriptionId: string, newPriceId: string): Promise<void>;
    recordUsageCharge(subscriptionId: string, usageAmount: number): Promise<void>;
    handlePaymentWebhook(event: any): Promise<void>;
}
//# sourceMappingURL=stripe.adapter.d.ts.map