export type Severity = 'critical' | 'high' | 'normal';

export class AlertPayload {
  constructor(
    public readonly triggeringEvent: string,
    public readonly renderedSummary: string,
    public readonly severity: Severity,
  ) {}

  static fromQuarantine(senderDomain: string): AlertPayload {
    return new AlertPayload(
      'message_quarantined',
      `Phishing alert: Message from ${senderDomain} was quarantined`,
      'critical',
    );
  }

  static fromPriorityEscalation(senderName: string, tier: string): AlertPayload {
    return new AlertPayload(
      'priority_escalated',
      `Priority escalation: Message from ${senderName} marked as ${tier}`,
      'high',
    );
  }

  static fromNeedsReplyAging(daysOld: number): AlertPayload {
    return new AlertPayload(
      'needs_reply_aging',
      `Unanswered message aging for ${daysOld} days`,
      'normal',
    );
  }

  toDb(): Record<string, any> {
    return {
      triggeringEvent: this.triggeringEvent,
      renderedSummary: this.renderedSummary,
      severity: this.severity,
    };
  }

  static fromDb(data: any): AlertPayload {
    return new AlertPayload(
      data.triggeringEvent,
      data.renderedSummary,
      data.severity,
    );
  }
}
