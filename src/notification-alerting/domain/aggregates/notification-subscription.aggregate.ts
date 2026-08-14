import { NotificationPreference, Channel } from '../value-objects/notification-preference';

export class NotificationSubscription {
  readonly tenantId: string;
  readonly userId: string;
  authorizedChannels: Set<Channel>;
  preferences: Map<string, NotificationPreference> = new Map();

  constructor(
    tenantId: string,
    userId: string,
    authorizedChannels: Channel[] = [],
  ) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.authorizedChannels = new Set(authorizedChannels);
    this.initializeSafeDefaults();
  }

  static create(
    tenantId: string,
    userId: string,
    authorizedChannels: Channel[] = [],
  ): NotificationSubscription {
    return new NotificationSubscription(tenantId, userId, authorizedChannels);
  }

  static fromDb(data: any): NotificationSubscription {
    const sub = new NotificationSubscription(
      data.tenant_id,
      data.user_id,
      data.authorized_channels || [],
    );
    // Clear defaults and load from db
    sub.preferences.clear();
    if (data.preferences) {
      Object.entries(data.preferences).forEach(([eventType, prefs]) => {
        sub.preferences.set(eventType, NotificationPreference.fromDb(prefs));
      });
    }
    return sub;
  }

  private initializeSafeDefaults(): void {
    // Safe defaults: phishing alerts immediate, everything else digest-only
    this.preferences.set(
      'message_quarantined',
      NotificationPreference.messageQuarantined(),
    );
    this.preferences.set(
      'priority_escalated',
      NotificationPreference.priorityEscalated(),
    );
    this.preferences.set(
      'needs_reply_aging',
      NotificationPreference.needsReplyAging(),
    );
  }

  updatePreference(
    eventType: string,
    preference: NotificationPreference,
  ): void {
    // Validate channel is authorized before allowing immediate delivery
    if (
      preference.isImmediate() &&
      !this.authorizedChannels.has(preference.preferredChannel)
    ) {
      throw new Error(
        `Channel ${preference.preferredChannel} not authorized for user`,
      );
    }
    this.preferences.set(eventType, preference);
  }

  getPreference(eventType: string): NotificationPreference | null {
    return this.preferences.get(eventType) || null;
  }

  shouldNotifyImmediately(eventType: string): boolean {
    const pref = this.getPreference(eventType);
    return pref ? pref.isImmediate() : false;
  }

  isChannelAuthorized(channel: Channel): boolean {
    return this.authorizedChannels.has(channel);
  }

  authorizeChannel(channel: Channel): void {
    this.authorizedChannels.add(channel);
  }

  revokeChannel(channel: Channel): void {
    this.authorizedChannels.delete(channel);
  }

  toDb(): Record<string, any> {
    const preferencesDb: Record<string, any> = {};
    this.preferences.forEach((pref, eventType) => {
      preferencesDb[eventType] = pref.toDb();
    });

    return {
      tenant_id: this.tenantId,
      user_id: this.userId,
      preferences: preferencesDb,
      authorized_channels: Array.from(this.authorizedChannels),
    };
  }
}
