export type EventType = 'message_quarantined' | 'priority_escalated' | 'needs_reply_aging';
export type DeliveryMode = 'immediate' | 'digest_only' | 'off';
export type Channel = 'push' | 'sms' | 'in_app' | 'digest_email';

export class NotificationPreference {
  constructor(
    public readonly eventType: EventType,
    public readonly deliveryMode: DeliveryMode,
    public readonly preferredChannel: Channel,
  ) {}

  static messageQuarantined(): NotificationPreference {
    return new NotificationPreference('message_quarantined', 'immediate', 'push');
  }

  static priorityEscalated(): NotificationPreference {
    return new NotificationPreference('priority_escalated', 'digest_only', 'digest_email');
  }

  static needsReplyAging(): NotificationPreference {
    return new NotificationPreference('needs_reply_aging', 'digest_only', 'digest_email');
  }

  isImmediate(): boolean {
    return this.deliveryMode === 'immediate';
  }

  isEnabled(): boolean {
    return this.deliveryMode !== 'off';
  }

  toDb(): Record<string, any> {
    return {
      eventType: this.eventType,
      deliveryMode: this.deliveryMode,
      preferredChannel: this.preferredChannel,
    };
  }

  static fromDb(data: any): NotificationPreference {
    return new NotificationPreference(
      data.eventType,
      data.deliveryMode,
      data.preferredChannel,
    );
  }
}
