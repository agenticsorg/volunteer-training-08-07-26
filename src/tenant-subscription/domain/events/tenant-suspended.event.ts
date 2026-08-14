import { DomainEvent } from '@common/domain/domain-event';

export class TenantSuspended extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly reason: string,
  ) {
    super();
  }
}
