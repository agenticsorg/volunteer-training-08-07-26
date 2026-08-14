import { Category } from '@prisma/client';
import { MessageClassification } from './domain/aggregates/message-classification';
import { RuleSignalEvaluator, RuleSignalSet } from './domain/value-objects/rule-signal-set';
import { ClassificationService } from './application/classification.service';

describe('Classification - Tier 1 Rule Signals', () => {
  let evaluator: RuleSignalEvaluator;

  beforeEach(() => {
    evaluator = new RuleSignalEvaluator();
  });

  it('should detect List-Unsubscribe header as automation signal', () => {
    const envelope = {
      headers: { 'list-unsubscribe': '<mailto:unsubscribe@example.com>' },
    };
    const signals = evaluator.evaluateSignals(envelope);
    expect(signals.listUnsubscribePresent).toBe(true);
  });

  it('should detect DMARC pass from auth results', () => {
    const envelope = {
      authResults: { dmarc: 'pass' },
    };
    const signals = evaluator.evaluateSignals(envelope);
    expect(signals.dmarcPass).toBe(true);
  });

  it('should detect METHOD=CANCEL from calendar part', () => {
    const envelope = {
      hasCalendarPart: true,
      methodType: 'CANCEL',
    };
    const signals = evaluator.evaluateSignals(envelope);
    expect(signals.methodCancelDetected).toBe(true);
  });

  it('should identify strong automation signals (2+ indicators)', () => {
    const signals: RuleSignalSet = {
      senderIsBrand: false,
      listUnsubscribePresent: true,
      precedenceBulk: true,
      autoSubmittedPresent: false,
      listIdPresent: false,
      dmarcPass: false,
      dkimPass: false,
      spfPass: false,
      methodCancelDetected: false,
      ecommerceMarkupDetected: false,
      threadStateAutomated: false,
    };
    expect(evaluator.hasStrongAutomationSignals(signals)).toBe(true);
  });
});

describe('Classification - NeedsReply Invariant', () => {
  it('should reject NeedsReply when assigned directly (invariant enforced)', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    expect(() => {
      classification.assignLabel({
        category: Category.NEEDS_REPLY,
        confidence: 0.7,
        sourceTier: 'rule',
        classifierVersion: '1.0.0',
      });
    }).toThrow('Cannot assign NeedsReply without checking automation signals');
  });

  it('should allow NeedsReply via assignNeedsReplyIfValid when no automation signals', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    const signals: RuleSignalSet = {
      senderIsBrand: false,
      listUnsubscribePresent: false,
      precedenceBulk: false,
      autoSubmittedPresent: false,
      listIdPresent: false,
      dmarcPass: false,
      dkimPass: false,
      spfPass: false,
      methodCancelDetected: false,
      ecommerceMarkupDetected: false,
      threadStateAutomated: false,
    };
    classification.assignNeedsReplyIfValid(signals, 0.6);
    expect(classification.labels.some(l => l.category === Category.NEEDS_REPLY)).toBe(true);
  });

  it('should prevent NeedsReply when strong automation signals present', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    const signals: RuleSignalSet = {
      senderIsBrand: false,
      listUnsubscribePresent: true,
      precedenceBulk: true,
      autoSubmittedPresent: false,
      listIdPresent: false,
      dmarcPass: false,
      dkimPass: false,
      spfPass: false,
      methodCancelDetected: false,
      ecommerceMarkupDetected: false,
      threadStateAutomated: false,
    };
    classification.assignNeedsReplyIfValid(signals, 0.6);
    expect(classification.labels.some(l => l.category === Category.NEEDS_REPLY)).toBe(false);
  });
});

describe('Classification - Finalization', () => {
  it('should prevent modification after finalization', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    classification.finalize();
    expect(() => {
      classification.assignLabel({
        category: Category.PERSONAL,
        confidence: 0.8,
        sourceTier: 'rule',
        classifierVersion: '1.0.0',
      });
    }).toThrow('Cannot modify finalized classification');
  });
});

describe('Classification - Multi-Label', () => {
  it('should support multiple labels per message', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    classification.assignLabel({
      category: Category.WORK,
      confidence: 0.8,
      sourceTier: 'rule',
      classifierVersion: '1.0.0',
    });
    classification.assignLabel({
      category: Category.FINANCE,
      confidence: 0.7,
      sourceTier: 'cheap_llm',
      classifierVersion: '1.0.0',
    });
    expect(classification.labels.length).toBe(2);
    expect(classification.labels.map(l => l.category)).toContain(Category.WORK);
    expect(classification.labels.map(l => l.category)).toContain(Category.FINANCE);
  });

  it('should upsert label with same category', () => {
    const classification = new MessageClassification('tenant-1', 'msg-1');
    classification.assignLabel({
      category: Category.WORK,
      confidence: 0.7,
      sourceTier: 'rule',
      classifierVersion: '1.0.0',
    });
    classification.assignLabel({
      category: Category.WORK,
      confidence: 0.85,
      sourceTier: 'cheap_llm',
      classifierVersion: '1.0.0',
    });
    expect(classification.labels.length).toBe(1);
    expect(classification.labels[0].confidence).toBe(0.85);
    expect(classification.labels[0].sourceTier).toBe('cheap_llm');
  });
});
