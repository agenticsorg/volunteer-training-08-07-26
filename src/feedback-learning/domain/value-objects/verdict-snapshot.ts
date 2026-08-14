export type Verdict = 'classification' | 'priority' | 'threat' | 'contact';

export class VerdictSnapshot {
  constructor(
    public readonly originatingContext: Verdict,
    public readonly messageId: string,
    public readonly originalVerdict: any,
    public readonly correctedVerdict: any,
    public readonly capturedAt: Date,
  ) {}

  isDifferent(): boolean {
    return (
      JSON.stringify(this.originalVerdict) !==
      JSON.stringify(this.correctedVerdict)
    );
  }

  toDb(): Record<string, any> {
    return {
      originatingContext: this.originatingContext,
      messageId: this.messageId,
      originalVerdict: this.originalVerdict,
      correctedVerdict: this.correctedVerdict,
      capturedAt: this.capturedAt,
    };
  }

  static fromDb(data: any): VerdictSnapshot {
    return new VerdictSnapshot(
      data.originatingContext,
      data.messageId,
      data.originalVerdict,
      data.correctedVerdict,
      data.capturedAt,
    );
  }
}
