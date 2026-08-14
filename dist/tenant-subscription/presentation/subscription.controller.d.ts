import { SubscriptionRepository } from '../infrastructure/repositories/subscription.repository';
import { PlanCatalogRepository } from '../infrastructure/repositories/plan-catalog.repository';
import { StripeAdapter } from '../infrastructure/adapters/stripe.adapter';
import { EventPublisherService } from '../application/event-publisher.service';
export declare class SubscriptionController {
    private subscriptionRepository;
    private planRepository;
    private billingAdapter;
    private eventPublisher;
    constructor(subscriptionRepository: SubscriptionRepository, planRepository: PlanCatalogRepository, billingAdapter: StripeAdapter, eventPublisher: EventPublisherService);
    getSubscription(tenantId: string, requestTenantId: string): Promise<{
        error: string;
        subscription?: undefined;
        plan?: undefined;
    } | {
        subscription: {
            id: string;
            status: "active" | "past_due" | "suspended" | "canceled";
            planVersion: number;
        };
        plan: {
            id: string | undefined;
            name: string | undefined;
            mailboxLimit: number | undefined;
        };
        error?: undefined;
    }>;
    changePlan(tenantId: string, { planId }: {
        planId: string;
    }, requestTenantId: string): Promise<{
        success: boolean;
    }>;
    handleStripeWebhook(event: any): Promise<{
        received: boolean;
    }>;
}
//# sourceMappingURL=subscription.controller.d.ts.map