export interface BillingProviderPort {
  createSubscription(tenantId: string, planId: string): Promise<{ customerId: string; subscriptionId: string }>;
  changePlan(subscriptionId: string, newPriceId: string): Promise<void>;
  recordUsageCharge(subscriptionId: string, usageAmount: number): Promise<void>;
  handlePaymentWebhook(event: any): Promise<void>;
}
