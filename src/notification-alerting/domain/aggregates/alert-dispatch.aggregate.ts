import { randomUUID } from 'crypto';
import { AlertPayload } from '../value-objects/alert-payload';
import { Channel } from '../value-objects/notification-preference';

export type AlertStatus = 'pending' | 'dispatched' | 'failed';

export class AlertDispatch {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly eventType: string;
  readonly payload: AlertPayload;
  readonly channel: Channel;
  status: AlertStatus;
  readonly dispatchedAt: Date;
  readonly coolDownUntil: Date;

  constructor(
    tenantId: string,
    userId: string,
    eventType: string,
    payload: AlertPayload,
    channel: Channel,
    coolDownMinutes: number = 15,
    id?: string,
    status: AlertStatus = 'pending',
    dispatchedAt?: Date,
  ) {
    this.id = id || randomUUID();
    this.tenantId = tenantId;
    this.userId = userId;
    this.eventType = eventType;
    this.payload = payload;
    this.channel = channel;
    this.status = status;
    this.dispatchedAt = dispatchedAt || new Date();

    // Calculate cool-down window
    const coolDownDate = new Date(this.dispatchedAt);
    coolDownDate.setMinutes(coolDownDate.getMinutes() + coolDownMinutes);
    this.coolDownUntil = coolDownDate;
  }

  static create(
    tenantId: string,
    userId: string,
    eventType: string,
    payload: AlertPayload,
    channel: Channel,
    coolDownMinutes: number = 15,
  ): AlertDispatch {
    return new AlertDispatch(
      tenantId,
      userId,
      eventType,
      payload,
      channel,
      coolDownMinutes,
    );
  }

  static fromDb(data: any): AlertDispatch {
    return new AlertDispatch(
      data.tenant_id,
      data.user_id,
      data.event_type || data.eventType,
      AlertPayload.fromDb(data.payload),
      data.channel,
      0, // cool-down is already computed
      data.id,
      data.status,
      data.dispatched_at || data.dispatchedAt,
    );
  }

  dispatch(): void {
    if (this.status === 'pending') {
      this.status = 'dispatched';
    }
  }

  markFailed(): void {
    if (this.status === 'pending') {
      this.status = 'failed';
    }
  }

  isInCoolDown(now: Date = new Date()): boolean {
    return now < this.coolDownUntil;
  }

  toDb(): Record<string, any> {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      user_id: this.userId,
      event_type: this.eventType,
      payload: this.payload.toDb(),
      channel: this.channel,
      status: this.status,
      dispatched_at: this.dispatchedAt,
      cool_down_until: this.coolDownUntil,
    };
  }
}
