export class InteractionEvent {
  readonly direction: 'inbound' | 'outbound';
  readonly messageId: string;
  readonly occurredAt: Date;

  constructor(direction: 'inbound' | 'outbound', messageId: string, occurredAt: Date) {
    this.direction = direction;
    this.messageId = messageId;
    this.occurredAt = occurredAt;
  }
}
