export class MessageIngestedEvent {
  constructor(
    readonly messageId: string,
    readonly tenantId: string,
    readonly mailboxId: string,
    readonly platform: string,
    readonly normalizedEnvelope: Record<string, any>,
    readonly timestamp: Date = new Date(),
  ) {}
}

export class MailboxSyncFailedEvent {
  constructor(
    readonly tenantId: string,
    readonly mailboxId: string,
    readonly reason: string,
    readonly timestamp: Date = new Date(),
  ) {}
}

export class WatchSubscriptionExpiringEvent {
  constructor(
    readonly mailboxId: string,
    readonly platform: string,
    readonly timestamp: Date = new Date(),
  ) {}
}
