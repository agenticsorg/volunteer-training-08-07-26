export class ReputationEntry {
  constructor(
    public readonly category: string,
    public readonly observationCount: number,
    public readonly confidenceWeight: number, // 0-1
    public readonly lastUpdatedAt: Date,
  ) {}

  withAdditionalObservation(
    confidenceBoost: number = 0.05,
  ): ReputationEntry {
    const newConfidence = Math.min(1.0, this.confidenceWeight + confidenceBoost);
    return new ReputationEntry(
      this.category,
      this.observationCount + 1,
      newConfidence,
      new Date(),
    );
  }

  isHighConfidence(threshold: number = 0.7): boolean {
    return this.confidenceWeight >= threshold;
  }

  toDb(): Record<string, any> {
    return {
      category: this.category,
      observationCount: this.observationCount,
      confidenceWeight: this.confidenceWeight,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }

  static fromDb(data: any): ReputationEntry {
    return new ReputationEntry(
      data.category,
      data.observationCount,
      data.confidenceWeight,
      data.lastUpdatedAt,
    );
  }
}
