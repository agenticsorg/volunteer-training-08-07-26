import { Channel } from '../value-objects/notification-preference';

export class AlertDispatched {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly alertId: string,
    public readonly channel: Channel,
    public readonly eventType: string,
    public readonly dispatchedAt: Date,
  ) {}
}
