import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { BillingProviderPort } from './billing-provider.port';
import { PlanCatalogRepository } from '../repositories/plan-catalog.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';

@Injectable()
export class StripeAdapter implements BillingProviderPort {
  private stripe: Stripe;
  private logger = new Logger('StripeAdapter');

  constructor(
    private planRepository: PlanCatalogRepository,
    private subscriptionRepository: SubscriptionRepository,
  ) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set - billing provider disabled');
      this.stripe = null as any;
    } else {
      this.stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' } as any);
    }
  }

  async createSubscription(tenantId: string, planId: string): Promise<{ customerId: string; subscriptionId: string }> {
    const plan = await this.planRepository.findById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

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

  async changePlan(subscriptionId: string, newPriceId: string): Promise<void> {
    if (!this.stripe) {
      this.logger.log(`Mock plan change for subscription ${subscriptionId}`);
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const itemId = subscription.items.data[0].id;

    await this.stripe.subscriptionItems.update(itemId, { price: newPriceId });
  }

  async recordUsageCharge(subscriptionId: string, usageAmount: number): Promise<void> {
    if (!this.stripe) {
      this.logger.log(`Mock usage charge ${usageAmount} for subscription ${subscriptionId}`);
      return;
    }

    // Stripe usage-based billing is handled via subscriptionItems
    // This would be called for per-unit charges
  }

  async handlePaymentWebhook(event: any): Promise<void> {
    if (!event || !event.data) return;

    const { type, data } = event;

    if (type === 'invoice.payment_failed') {
      const invoice = data.object as any;
      const customerId = invoice.customer;

      // Find subscription by Stripe customer ID and mark as past due
      const subscriptions = await this.subscriptionRepository.findByTenantId(customerId);
      if (subscriptions) {
        subscriptions.markPastDue();
        await this.subscriptionRepository.save(subscriptions);
      }
    }
  }
}
