import { Injectable } from '@nestjs/common';
import { MessageClassification } from '../domain/aggregates/message-classification';
import { RuleSignalEvaluator } from '../domain/value-objects/rule-signal-set';
import { AnthropicClassifierAdapter } from '../infrastructure/adapters/anthropic-classifier.adapter';
import { MessageClassificationRepository } from '../infrastructure/repositories/message-classification.repository';
import { Category } from '@prisma/client';

@Injectable()
export class ClassificationService {
  private ruleEvaluator = new RuleSignalEvaluator();

  constructor(
    private classificationRepo: MessageClassificationRepository,
    private anthropicAdapter: AnthropicClassifierAdapter,
  ) {}

  async classifyMessage(
    tenantId: string,
    messageId: string,
    messageEnvelope: any,
  ): Promise<MessageClassification> {
    const classification = new MessageClassification(tenantId, messageId);

    // Tier 1: Rule-based signals
    const signals = this.ruleEvaluator.evaluateSignals(messageEnvelope);

    // Assign basic categories from rules
    if (signals.methodCancelDetected) {
      classification.assignLabel({
        category: Category.SHOPPING,
        confidence: 0.95,
        sourceTier: 'rule',
        classifierVersion: '1.0.0',
      });
    }

    if (signals.ecommerceMarkupDetected) {
      classification.assignLabel({
        category: Category.SHOPPING,
        confidence: 0.85,
        sourceTier: 'rule',
        classifierVersion: '1.0.0',
      });
    }

    // Assign NeedsReply only if no strong automation signals
    if (!this.ruleEvaluator.hasStrongAutomationSignals(signals)) {
      classification.assignNeedsReplyIfValid(signals, 0.6);
    }

    // Tier 2: Cheap LLM (if needed)
    if (classification.labels.length === 0 || classification.labels.some(l => l.confidence < 0.8)) {
      const cheapResults = await this.anthropicAdapter.classifyWithHaiku(
        messageEnvelope.subject || '',
      );
      for (const result of cheapResults) {
        if (!classification.labels.find(l => l.category === result.category)) {
          classification.assignLabel({
            category: result.category,
            confidence: result.confidence,
            sourceTier: 'cheap_llm',
            classifierVersion: '1.0.0',
          });
        }
      }
    }

    classification.finalize();
    await this.classificationRepo.save(tenantId, classification);

    return classification;
  }
}
