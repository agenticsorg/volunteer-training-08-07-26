export class MessagePrioritized {
  constructor(
    readonly tenantId: string,
    readonly messageId: string,
    readonly score: number,
    readonly tier: string,
    readonly components: any[],
    readonly computedAt: Date,
  ) {}
}

export class MessagePriorityEscalated {
  constructor(
    readonly tenantId: string,
    readonly messageId: string,
    readonly previousTier: string,
    readonly newTier: string,
    readonly reason: string,
  ) {}
}
