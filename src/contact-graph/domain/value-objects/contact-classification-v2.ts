// Simpler contact classification model for scoring

export interface SignalContribution {
  signalType: string;
  indicatesPersonal: boolean; // true if signal points toward "personal", false if toward "automated"
  weight: number;
  detected: boolean; // whether this signal was detected
}

export class SimpleContactClassification {
  readonly classification: 'personal' | 'automated';
  readonly confidence: number;

  private constructor(classification: 'personal' | 'automated', confidence: number) {
    this.classification = classification;
    this.confidence = confidence;
  }

  static fromSignals(signals: SignalContribution[]): SimpleContactClassification {
    let personalScore = 0;
    let automatedScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      if (!signal.detected) continue;

      totalWeight += signal.weight;
      if (signal.indicatesPersonal) {
        personalScore += signal.weight;
      } else {
        automatedScore += signal.weight;
      }
    }

    if (totalWeight === 0) {
      return new SimpleContactClassification('unknown' as any, 0);
    }

    const confidence = personalScore / totalWeight;
    const classification = confidence > 0.5 ? 'personal' : 'automated';

    return new SimpleContactClassification(classification, confidence);
  }
}
