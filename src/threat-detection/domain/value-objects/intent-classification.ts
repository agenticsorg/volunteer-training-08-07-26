export type PhishingIntent = 'CredentialHarvesting' | 'BEC' | 'MalwareDelivery' | 'None';

export class IntentClassification {
  readonly intent: PhishingIntent;
  readonly confidence: number; // 0.0 - 1.0
  readonly justification: string;

  constructor(props: {
    intent: PhishingIntent;
    confidence: number;
    justification: string;
  }) {
    if (props.confidence < 0 || props.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
    this.intent = props.intent;
    this.confidence = props.confidence;
    this.justification = props.justification.substring(0, 500); // Enforce schema constraint
  }

  isHighConfidence(): boolean {
    return this.confidence >= 0.8 && this.intent !== 'None';
  }

  static none(): IntentClassification {
    return new IntentClassification({
      intent: 'None',
      confidence: 0,
      justification: 'No malicious intent detected',
    });
  }

  toJSON() {
    return {
      intent: this.intent,
      confidence: this.confidence,
      justification: this.justification,
    };
  }

  static fromJSON(json: any): IntentClassification {
    return new IntentClassification({
      intent: json.intent ?? 'None',
      confidence: json.confidence ?? 0,
      justification: json.justification ?? '',
    });
  }
}
