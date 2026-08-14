export class MessageThreatAssessed {
  constructor(
    readonly tenantId: string,
    readonly messageId: string,
    readonly authenticationSignal: any,
    readonly lookalikeScore: any,
    readonly intentClassification: any,
    readonly quarantineDecision: any,
    readonly assessedAt: Date,
  ) {}
}

export class MessageQuarantined {
  constructor(
    readonly tenantId: string,
    readonly messageId: string,
    readonly reason: string,
    readonly decidedAt: Date,
  ) {}
}

export class QuarantineOverridden {
  constructor(
    readonly tenantId: string,
    readonly messageId: string,
    readonly overriddenBy: string, // user ID or admin ID
    readonly previousDecision: any,
    readonly newDecision: any,
    readonly reason: string,
  ) {}
}
