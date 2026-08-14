export type SignalType = 'VipStatus' | 'InteractionFrequency' | 'UrgencyLanguage' | 'CalendarProximity' | 'NeedsReplyAging';

export class ScoreComponent {
  readonly signal: SignalType;
  readonly contribution: number; // signed integer
  readonly evidence: string;

  constructor(signal: SignalType, contribution: number, evidence: string) {
    if (contribution < -100 || contribution > 100) {
      throw new Error('ScoreComponent contribution must be between -100 and 100');
    }
    this.signal = signal;
    this.contribution = contribution;
    this.evidence = evidence;
  }

  toJSON() {
    return {
      signal: this.signal,
      contribution: this.contribution,
      evidence: this.evidence,
    };
  }

  static fromJSON(json: any): ScoreComponent {
    return new ScoreComponent(json.signal, json.contribution, json.evidence);
  }
}
