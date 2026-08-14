export type NotificationPreference = 'immediate' | 'digest_only' | 'off';

export interface AlertDispatchRecord {
  alert_id: string;
  user_id: string;
  triggering_category: string;
  dispatched_at: Date;
  cool_down_until: Date;
}

export class NotificationSubscription {
  constructor(
    public tenant_id: string,
    public user_id: string,
    public preferences: Map<string, NotificationPreference> = new Map([
      ['phishing', 'immediate'],
      ['general', 'digest_only'],
    ]),
    public authorized_channels: string[] = [],
  ) {}

  canUseChannel(channel: string): boolean {
    return this.authorized_channels.includes(channel);
  }

  getPreference(event_type: string): NotificationPreference {
    return this.preferences.get(event_type) || 'digest_only';
  }
}

export class AlertDispatch {
  dispatch_records: AlertDispatchRecord[] = [];

  canDispatchAlert(user_id: string, category: string, cool_down_seconds: number): boolean {
    const recent = this.dispatch_records.find(r => r.user_id === user_id && r.triggering_category === category);
    if (!recent) return true;
    const now = new Date();
    return now.getTime() >= recent.cool_down_until.getTime();
  }

  recordDispatch(alert_id: string, user_id: string, category: string, cool_down_seconds: number): void {
    const now = new Date();
    const cool_down_until = new Date(now.getTime() + cool_down_seconds * 1000);
    this.dispatch_records.push({ alert_id, user_id, triggering_category: category, dispatched_at: now, cool_down_until });
  }
}
