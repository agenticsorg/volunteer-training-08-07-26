import { AutomatedSenderSignal, ContactClassification } from '../value-objects/contact-classification';
import { InteractionEvent } from '../entities/interaction-event.entity';
import { VipDesignation } from '../value-objects/vip-designation';
import {
  SenderClassifiedEvent,
  ContactPromotedToVipEvent,
  InteractionFrequencyUpdatedEvent,
} from '../events/index';

export interface ContactSignals {
  automationHeaderAbsent: boolean;
  fromAddressValid: boolean;
  contactsApiMatch: boolean;
  bidirectionalThreadHistory: boolean;
  displayNamePersonal: boolean;
}

export interface InteractionFrequency {
  totalInteractions: number;
  bidirectionalCount: number;
  inboundCount: number;
  outboundCount: number;
  windowDays: number;
}

export class SenderProfile {
  readonly tenantId: string;
  readonly mailboxId: string;
  readonly senderAddress: string;

  classification: ContactClassification;
  isVip: boolean = false;
  vipAutoPromoted: boolean = false;

  private interactionEvents: InteractionEvent[] = [];
  private domainEvents: Array<any> = [];

  constructor(tenantId: string, mailboxId: string, senderAddress: string) {
    this.tenantId = tenantId;
    this.mailboxId = mailboxId;
    this.senderAddress = senderAddress;
    this.classification = ContactClassification.unknown();
  }

  updateClassification(signals: ContactSignals): void {
    const signalObjects = [
      AutomatedSenderSignal.fromListUnsubscribeHeader(!signals.automationHeaderAbsent),
      AutomatedSenderSignal.fromFromAddressPattern(
        signals.fromAddressValid ? 'user@example.com' : 'noreply@service.com'
      ),
      AutomatedSenderSignal.fromContactsApiMatch(signals.contactsApiMatch),
      AutomatedSenderSignal.fromBidirectionalHistory(signals.bidirectionalThreadHistory),
      AutomatedSenderSignal.fromDisplayNameHeuristic(signals.displayNamePersonal),
    ];

    const oldClassification = this.classification;
    this.classification = ContactClassification.fromSignals(signalObjects);

    // Publish SenderClassified event if classification changed materially
    if (oldClassification.classification !== this.classification.classification ||
        Math.abs(oldClassification.confidence - this.classification.confidence) > 0.1) {
      if (this.classification.classification !== 'unknown') {
        this.domainEvents.push(
          new SenderClassifiedEvent(
            this.tenantId,
            this.mailboxId,
            this.senderAddress,
            this.classification.classification as 'personal' | 'automated',
            this.classification.confidence,
            new Date()
          )
        );
      }
    }
  }

  recordInteraction(direction: 'inbound' | 'outbound', messageId: string, occurredAt: Date): void {
    const event = new InteractionEvent(direction, messageId, occurredAt);
    this.interactionEvents.push(Object.freeze(event));
  }

  getInteractionEvents(): readonly InteractionEvent[] {
    return Object.freeze([...this.interactionEvents]);
  }

  computeInteractionFrequency(windowDays: number): InteractionFrequency {
    const now = new Date();
    const cutoffTime = now.getTime() - (windowDays * 24 * 60 * 60 * 1000);

    const recentEvents = this.interactionEvents.filter(
      e => new Date(e.occurredAt).getTime() > cutoffTime
    );

    let bidirectionalCount = 0;
    let inboundCount = 0;
    let outboundCount = 0;

    for (const event of recentEvents) {
      if (event.direction === 'inbound') {
        inboundCount++;
      } else {
        outboundCount++;
      }
    }

    // Bidirectional count = number of times owner has sent TO this address (outbound)
    // This is the strongest personal contact signal per ADR-0011
    bidirectionalCount = outboundCount;

    return {
      totalInteractions: recentEvents.length,
      bidirectionalCount,
      inboundCount,
      outboundCount,
      windowDays,
    };
  }

  promoteToVipIfQualified(minBidirectionalThreshold: number, windowDays: number): boolean {
    if (this.isVip) return false;

    // Can only auto-promote if Personal or manually overridden
    if (this.classification.classification !== 'personal') {
      return false;
    }

    const frequency = this.computeInteractionFrequency(windowDays);
    if (frequency.bidirectionalCount >= minBidirectionalThreshold) {
      this.isVip = true;
      this.vipAutoPromoted = true;

      this.domainEvents.push(
        new ContactPromotedToVipEvent(
          this.tenantId,
          this.mailboxId,
          this.senderAddress,
          'autoPromoted',
          new Date()
        )
      );
      return true;
    }

    return false;
  }

  setManualVipDesignation(isVip: boolean): void {
    const wasVip = this.isVip;
    this.isVip = isVip;
    this.vipAutoPromoted = false;

    if (isVip && !wasVip) {
      this.domainEvents.push(
        new ContactPromotedToVipEvent(
          this.tenantId,
          this.mailboxId,
          this.senderAddress,
          'manual',
          new Date()
        )
      );
    }
  }

  updateInteractionFrequency(windowDays: number): void {
    const frequency = this.computeInteractionFrequency(windowDays);

    this.domainEvents.push(
      new InteractionFrequencyUpdatedEvent(
        this.tenantId,
        this.mailboxId,
        this.senderAddress,
        frequency.bidirectionalCount,
        frequency.totalInteractions,
        windowDays,
        new Date()
      )
    );
  }

  getDomainEvents(): Array<any> {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
