import { Injectable } from '@nestjs/common';
import { IntentClassification, PhishingIntent } from '../../domain/value-objects';

export interface ClassifierPort {
  classifyStructured(params: {
    text: string;
    schema: Record<string, any>;
    systemPrompt: string;
    userPrompt: string;
    tier: 'cheap' | 'frontier';
  }): Promise<Record<string, any>>;
}

@Injectable()
export class ThreatIntentClassifierAdapter {
  constructor(private classifier: ClassifierPort) {}

  async classifyPhishingIntent(
    messageBody: string,
    senderDomain: string,
  ): Promise<IntentClassification> {
    const schema = {
      intent: {
        type: 'string',
        enum: ['CredentialHarvesting', 'BEC', 'MalwareDelivery', 'None'],
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      justification: { type: 'string', maxLength: 500 },
    };

    const systemPrompt = `You are a phishing detection expert. Analyze the email body and sender domain for malicious intent.
Return a phishing intent classification with confidence score (0-1).
Focus on: credential harvesting patterns, BEC tactics, malware delivery indicators, impersonation.
If no clear malicious pattern is detected, return 'None'.`;

    const userPrompt = `Analyze this email for phishing intent:
Sender Domain: ${senderDomain}
Email Body: ${messageBody.substring(0, 2000)}`;

    try {
      const result = await this.classifier.classifyStructured({
        text: messageBody,
        schema,
        systemPrompt,
        userPrompt,
        tier: 'frontier', // Phishing detection is safety-critical, use best model
      });

      return new IntentClassification({
        intent: (result.intent as PhishingIntent) || 'None',
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        justification: (result.justification || '').substring(0, 500),
      });
    } catch (error) {
      console.error('Phishing intent classification failed:', error);
      return IntentClassification.none();
    }
  }
}
