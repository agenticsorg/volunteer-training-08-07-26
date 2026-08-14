export abstract class DomainEvent {
  public readonly occurredAt: Date = new Date();
  public readonly eventId: string = crypto.randomUUID();
}
