import { DomainEvent } from '@common/domain/domain-event';

export class UsageOverageDetected extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly meterType: string,
    public readonly billingPeriodStart: Date,
    public readonly billingPeriodEnd: Date,
    public readonly usage: number,
    public readonly threshold: number,
  ) {
    super();
  }
}
