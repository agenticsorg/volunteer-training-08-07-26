export type ContactClassificationType = 'personal' | 'automated' | 'unknown';

export class AutomatedSenderSignal {
  readonly signalType: string;
  readonly present: boolean;
  readonly weight: number;

  private constructor(signalType: string, present: boolean, weight: number) {
    this.signalType = signalType;
    this.present = present;
    this.weight = weight;
  }

  static fromListUnsubscribeHeader(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('ListUnsubscribeHeader', present, 0.4);
  }

  static fromPrecedenceBulk(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('PrecedenceBulk', present, 0.4);
  }

  static fromAutoSubmitted(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('AutoSubmitted', present, 0.3);
  }

  static fromListId(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('ListId', present, 0.3);
  }

  static fromFromAddressPattern(address: string): AutomatedSenderSignal {
    const isNoreply = /^(noreply|no-reply|notifications?|.*@no-reply)@/.test(address);
    return new AutomatedSenderSignal('NoReplyLocalPart', isNoreply, 0.2);
  }

  static fromContactsApiMatch(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('ContactsApiMatch', present, 0.4);
  }

  static fromBidirectionalHistory(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('BidirectionalHistory', present, 0.4);
  }

  static fromDisplayNameHeuristic(present: boolean): AutomatedSenderSignal {
    return new AutomatedSenderSignal('DisplayNameHeuristic', present, 0.1);
  }
}

export class ContactClassification {
  readonly classification: ContactClassificationType;
  readonly confidence: number;
  readonly contributingSignals: AutomatedSenderSignal[];

  private constructor(
    classification: ContactClassificationType,
    confidence: number,
    signals: AutomatedSenderSignal[]
  ) {
    this.classification = classification;
    this.confidence = Math.min(1, Math.max(0, confidence));
    this.contributingSignals = signals;
  }

  static unknown(): ContactClassification {
    return new ContactClassification('unknown', 0, []);
  }

  static fromSignals(signals: AutomatedSenderSignal[]): ContactClassification {
    // Score based on signal evidence
    // Some signals indicate automation, others indicate personal contact
    // Signal meanings:
    // - ListUnsubscribeHeader.present=true => automation
    // - PrecedenceBulk.present=true => automation
    // - AutoSubmitted.present=true => automation
    // - ListId.present=true => automation
    // - NoReplyLocalPart.present=true => automation
    // - DisplayNameHeuristic.present=true => neutral/slight automation
    // - ContactsApiMatch.present=true => personal (contact exists)
    // - BidirectionalHistory.present=true => personal (owner sent to them)

    let personalScore = 0;
    let automatedScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      totalWeight += signal.weight;

      if (signal.signalType === 'ContactsApiMatch' || signal.signalType === 'BidirectionalHistory') {
        // These signals indicate PERSONAL contact
        if (signal.present) {
          personalScore += signal.weight;
        }
      } else {
        // All other signals indicate AUTOMATION
        if (signal.present) {
          automatedScore += signal.weight;
        } else {
          personalScore += signal.weight;
        }
      }
    }

    const confidence = totalWeight > 0 ? personalScore / totalWeight : 0;
    const classification = confidence > 0.5 ? 'personal' : 'automated';

    return new ContactClassification(
      classification as ContactClassificationType,
      confidence,
      signals
    );
  }
}
