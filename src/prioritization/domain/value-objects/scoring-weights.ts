export class ScoringWeights {
  readonly vipWeight: number;
  readonly frequencyWeight: number;
  readonly urgencyWeight: number;
  readonly calendarWeight: number;
  readonly needsReplyAgingWeight: number;

  constructor(
    vipWeight = 0.25,
    frequencyWeight = 0.20,
    urgencyWeight = 0.30,
    calendarWeight = 0.10,
    needsReplyAgingWeight = 0.15,
  ) {
    const total = vipWeight + frequencyWeight + urgencyWeight + calendarWeight + needsReplyAgingWeight;
    if (Math.abs(total - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0 (got ${total})`);
    }
    this.vipWeight = vipWeight;
    this.frequencyWeight = frequencyWeight;
    this.urgencyWeight = urgencyWeight;
    this.calendarWeight = calendarWeight;
    this.needsReplyAgingWeight = needsReplyAgingWeight;
  }

  static defaults(): ScoringWeights {
    return new ScoringWeights(0.25, 0.20, 0.30, 0.10, 0.15);
  }

  toJSON() {
    return {
      vipWeight: this.vipWeight,
      frequencyWeight: this.frequencyWeight,
      urgencyWeight: this.urgencyWeight,
      calendarWeight: this.calendarWeight,
      needsReplyAgingWeight: this.needsReplyAgingWeight,
    };
  }

  static fromJSON(json: any): ScoringWeights {
    return new ScoringWeights(
      json.vipWeight,
      json.frequencyWeight,
      json.urgencyWeight,
      json.calendarWeight,
      json.needsReplyAgingWeight,
    );
  }
}
