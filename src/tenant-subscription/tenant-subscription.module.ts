import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { SubscriptionController } from './presentation/subscription.controller';
import { SubscriptionRepository } from './infrastructure/repositories/subscription.repository';
import { UsageMeterRepository } from './infrastructure/repositories/usage-meter.repository';
import { PlanCatalogRepository } from './infrastructure/repositories/plan-catalog.repository';
import { StripeAdapter } from './infrastructure/adapters/stripe.adapter';
import { EventPublisherService } from './application/event-publisher.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionRepository,
    UsageMeterRepository,
    PlanCatalogRepository,
    StripeAdapter,
    EventPublisherService,
    {
      provide: 'BillingProviderAdapter',
      useClass: StripeAdapter,
    },
  ],
  exports: [SubscriptionRepository, UsageMeterRepository, PlanCatalogRepository, StripeAdapter, EventPublisherService],
})
export class TenantSubscriptionModule {}
