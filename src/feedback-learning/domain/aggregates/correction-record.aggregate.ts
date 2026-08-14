import { randomUUID } from 'crypto';
import { VerdictSnapshot } from '../value-objects/verdict-snapshot';
import {
  CorrectionEvidence,
  CorrectionSource,
  CorrectionState,
} from '../value-objects/correction-evidence';

export type DomainEvent = any; // Will define specific events separately

export class CorrectionRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly messageId: string;
  readonly verdictSnapshot: VerdictSnapshot;
  evidence: CorrectionEvidence;
  state: CorrectionState;
  private domainEvents: DomainEvent[] = [];

  constructor(
    tenantId: string,
    messageId: string,
    verdictSnapshot: VerdictSnapshot,
    evidence: CorrectionEvidence,
    id?: string,
    state: CorrectionState = 'confirmed',
  ) {
    this.id = id || randomUUID();
    this.tenantId = tenantId;
    this.messageId = messageId;
    this.verdictSnapshot = verdictSnapshot;
    this.evidence = evidence;
    this.state = state;
  }

  static create(
    tenantId: string,
    messageId: string,
    verdictSnapshot: VerdictSnapshot,
    source: CorrectionSource,
  ): CorrectionRecord {
    const evidence = new CorrectionEvidence(source, new Date());
    const initialState = source === 'passive_inferred' ? 'candidate' : 'confirmed';
    return new CorrectionRecord(
      tenantId,
      messageId,
      verdictSnapshot,
      evidence,
      undefined,
      initialState,
    );
  }

  static fromDb(data: any): CorrectionRecord {
    return new CorrectionRecord(
      data.tenant_id,
      data.message_id,
      VerdictSnapshot.fromDb(data.verdict),
      CorrectionEvidence.fromDb(data.verdict),
      data.id,
      data.state,
    );
  }

  confirmCandidate(): void {
    if (this.state === 'candidate') {
      this.state = 'confirmed';
    }
  }

  markProcessed(): void {
    if (this.state === 'confirmed') {
      this.state = 'processed';
    }
  }

  corroborate(): void {
    if (this.state === 'candidate') {
      this.evidence = this.evidence.withAdditionalCorroboration();
      // Promote to confirmed after sufficient corroboration (threshold: 2)
      if (this.evidence.corroborationCount >= 2) {
        this.confirmCandidate();
      }
    }
  }

  isTrusted(): boolean {
    return this.evidence.isHighTrust() || this.state === 'confirmed';
  }

  isDifferent(): boolean {
    return this.verdictSnapshot.isDifferent();
  }

  toDb(): Record<string, any> {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      message_id: this.messageId,
      verdict: this.verdictSnapshot.toDb(),
      source: this.evidence.source,
      state: this.state,
      created_at: this.verdictSnapshot.capturedAt,
    };
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  pushEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}
