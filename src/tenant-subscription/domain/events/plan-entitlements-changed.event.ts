import { DomainEvent } from '@common/domain/domain-event';

export class PlanEntitlementsChanged extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly planId: string,
    public readonly entitlements: {
      mailboxLimit: number;
      llmTierCeiling: string;
      features: Record<string, unknown>;
    },
    public readonly version: number,
  ) {
    super();
  }
}
