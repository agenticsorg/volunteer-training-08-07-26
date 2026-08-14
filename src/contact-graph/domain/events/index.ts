export class SenderClassifiedEvent {
  readonly type = 'SenderClassified';
  readonly tenantId: string;
  readonly mailboxId: string;
  readonly senderAddress: string;
  readonly classification: 'personal' | 'automated';
  readonly confidence: number;
  readonly classifiedAt: Date;

  constructor(
    tenantId: string,
    mailboxId: string,
    senderAddress: string,
    classification: 'personal' | 'automated',
    confidence: number,
    classifiedAt: Date
  ) {
    this.tenantId = tenantId;
    this.mailboxId = mailboxId;
    this.senderAddress = senderAddress;
    this.classification = classification;
    this.confidence = confidence;
    this.classifiedAt = classifiedAt;
  }
}

export class ContactPromotedToVipEvent {
  readonly type = 'ContactPromotedToVip';
  readonly tenantId: string;
  readonly mailboxId: string;
  readonly senderAddress: string;
  readonly source: 'manual' | 'autoPromoted';
  readonly promotedAt: Date;

  constructor(
    tenantId: string,
    mailboxId: string,
    senderAddress: string,
    source: 'manual' | 'autoPromoted',
    promotedAt: Date
  ) {
    this.tenantId = tenantId;
    this.mailboxId = mailboxId;
    this.senderAddress = senderAddress;
    this.source = source;
    this.promotedAt = promotedAt;
  }
}

export class InteractionFrequencyUpdatedEvent {
  readonly type = 'InteractionFrequencyUpdated';
  readonly tenantId: string;
  readonly mailboxId: string;
  readonly senderAddress: string;
  readonly bidirectionalCount: number;
  readonly totalInteractions: number;
  readonly windowDays: number;
  readonly computedAt: Date;

  get frequencyScore(): number {
    return this.totalInteractions > 0 ? this.bidirectionalCount / this.totalInteractions : 0;
  }

  constructor(
    tenantId: string,
    mailboxId: string,
    senderAddress: string,
    bidirectionalCount: number,
    totalInteractions: number,
    windowDays: number,
    computedAt: Date
  ) {
    this.tenantId = tenantId;
    this.mailboxId = mailboxId;
    this.senderAddress = senderAddress;
    this.bidirectionalCount = bidirectionalCount;
    this.totalInteractions = totalInteractions;
    this.windowDays = windowDays;
    this.computedAt = computedAt;
  }
}
