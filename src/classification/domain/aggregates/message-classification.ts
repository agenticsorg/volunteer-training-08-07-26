import { Category } from '@prisma/client';
import { RuleSignalSet } from '../value-objects/rule-signal-set';

export interface LabelAssignment {
  category: Category;
  confidence: number;
  sourceTier: 'rule' | 'cheap_llm' | 'frontier_llm';
  classifierVersion: string;
}

export class MessageClassification {
  readonly tenantId: string;
  readonly messageId: string;
  labels: LabelAssignment[] = [];
  isFinalized: boolean = false;
  tierAttempted: 'rule' | 'cheap_llm' | 'frontier_llm' | null = null;
  pipelineVersion: string = '1.0.0';

  constructor(tenantId: string, messageId: string) {
    this.tenantId = tenantId;
    this.messageId = messageId;
  }

  assignLabel(label: LabelAssignment): void {
    if (this.isFinalized) {
      throw new Error('Cannot modify finalized classification');
    }
    // Prevent NeedsReply assignment when strong automation signals present
    if (label.category === Category.NEEDS_REPLY) {
      throw new Error('Cannot assign NeedsReply without checking automation signals');
    }
    // Upsert label
    const existing = this.labels.findIndex(l => l.category === label.category);
    if (existing >= 0) {
      this.labels[existing] = label;
    } else {
      this.labels.push(label);
    }
  }

  assignNeedsReplyIfValid(signals: RuleSignalSet, confidence: number): void {
    if (this.isFinalized) {
      throw new Error('Cannot modify finalized classification');
    }
    // Only assign NeedsReply if weak automation signals
    if (!signals.listUnsubscribePresent && !signals.precedenceBulk && !signals.autoSubmittedPresent) {
      this.assignLabel({
        category: Category.NEEDS_REPLY,
        confidence,
        sourceTier: 'rule',
        classifierVersion: this.pipelineVersion,
      });
    }
  }

  finalize(): void {
    this.isFinalized = true;
  }
}
