import { Channel } from '../value-objects/notification-preference';

export class NotificationDeliveryFailed {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly channel: Channel,
    public readonly reason: string,
  ) {}
}
