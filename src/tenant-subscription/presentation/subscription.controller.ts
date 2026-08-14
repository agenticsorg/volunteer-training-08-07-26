import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionRepository } from '../infrastructure/repositories/subscription.repository';
import { PlanCatalogRepository } from '../infrastructure/repositories/plan-catalog.repository';
import { StripeAdapter } from '../infrastructure/adapters/stripe.adapter';
import { EventPublisherService } from '../application/event-publisher.service';
import { Tenant } from '@common/decorators/tenant.decorator';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanCatalogRepository,
    private billingAdapter: StripeAdapter,
    private eventPublisher: EventPublisherService,
  ) {}

  @Get(':tenantId')
  async getSubscription(@Param('tenantId') tenantId: string, @Tenant() requestTenantId: string) {
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

  @Post(':tenantId/change-plan')
  async changePlan(
    @Param('tenantId') tenantId: string,
    @Body() { planId }: { planId: string },
    @Tenant() requestTenantId: string,
  ) {
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

  @Post('webhooks/stripe')
  async handleStripeWebhook(@Body() event: any) {
    await this.billingAdapter.handlePaymentWebhook(event);
    return { received: true };
  }
}
