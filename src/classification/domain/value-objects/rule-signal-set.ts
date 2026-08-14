export interface RuleSignalSet {
  senderIsBrand: boolean;
  listUnsubscribePresent: boolean;
  precedenceBulk: boolean;
  autoSubmittedPresent: boolean;
  listIdPresent: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  spfPass: boolean;
  methodCancelDetected: boolean;
  ecommerceMarkupDetected: boolean;
  threadStateAutomated: boolean; // last sender != mailbox owner
}

export class RuleSignalEvaluator {
  evaluateSignals(envelope: any): RuleSignalSet {
    // Placeholder: real implementation would parse MessageEnvelope
    // and evaluate each signal from headers and metadata
    return {
      senderIsBrand: false,
      listUnsubscribePresent: envelope.headers?.['list-unsubscribe'] ? true : false,
      precedenceBulk: envelope.headers?.['precedence'] === 'bulk',
      autoSubmittedPresent: !!envelope.headers?.['auto-submitted'],
      listIdPresent: !!envelope.headers?.['list-id'],
      dmarcPass: envelope.authResults?.dmarc === 'pass',
      dkimPass: envelope.authResults?.dkim === 'pass',
      spfPass: envelope.authResults?.spf === 'pass',
      methodCancelDetected: envelope.hasCalendarPart && envelope.methodType === 'CANCEL',
      ecommerceMarkupDetected: envelope.hasEcommerceMarkup || false,
      threadStateAutomated: envelope.lastSenderIsMailboxOwner === false,
    };
  }

  hasStrongAutomationSignals(signals: RuleSignalSet): boolean {
    const automationSignals = [
      signals.listUnsubscribePresent,
      signals.precedenceBulk,
      signals.autoSubmittedPresent,
      signals.listIdPresent,
    ].filter(Boolean).length;
    return automationSignals >= 2; // 2+ automation signals = strong indicator
  }
}
