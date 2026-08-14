import { Test, TestingModule } from '@nestjs/testing';
import { StripeAdapter } from './stripe.adapter';
import { PlanCatalogRepository } from '../repositories/plan-catalog.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { Subscription } from '../../domain/aggregates/subscription.aggregate';

describe('StripeAdapter', () => {
  let adapter: StripeAdapter;
  let planRepository: PlanCatalogRepository;
  let subscriptionRepository: SubscriptionRepository;

  const mockPlanRepository = {
    findById: jest.fn(),
  };

  const mockSubscriptionRepository = {
    findByTenantId: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeAdapter,
        {
          provide: PlanCatalogRepository,
          useValue: mockPlanRepository,
        },
        {
          provide: SubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
      ],
    }).compile();

    adapter = module.get<StripeAdapter>(StripeAdapter);
    planRepository = module.get<PlanCatalogRepository>(PlanCatalogRepository);
    subscriptionRepository = module.get<SubscriptionRepository>(SubscriptionRepository);
  });

  describe('handlePaymentWebhook', () => {
    it('should handle invoice.payment_failed webhook', async () => {
      const tenantId = 'tenant-1';
      const subscription = new Subscription('sub-1', tenantId, 'plan-1', 'active');

      mockSubscriptionRepository.findByTenantId.mockResolvedValue(subscription);
      mockSubscriptionRepository.save.mockResolvedValue(void 0);

      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: tenantId,
          },
        },
      };

      await adapter.handlePaymentWebhook(event);

      expect(subscription.status).toBe('past_due');
      expect(mockSubscriptionRepository.save).toHaveBeenCalledWith(subscription);
    });

    it('should not process non-payment-failure events', async () => {
      const event = {
        type: 'customer.created',
        data: {
          object: { id: 'cus_123' },
        },
      };

      await adapter.handlePaymentWebhook(event);

      expect(mockSubscriptionRepository.findByTenantId).not.toHaveBeenCalled();
    });

    it('should ignore events without data', async () => {
      await adapter.handlePaymentWebhook(null);
      expect(mockSubscriptionRepository.findByTenantId).not.toHaveBeenCalled();

      await adapter.handlePaymentWebhook({});
      expect(mockSubscriptionRepository.findByTenantId).not.toHaveBeenCalled();
    });
  });
});
