export type CorrectionSource = 'passive_inferred' | 'explicit_user_action' | 'admin_override';

export interface VerdictSnapshot {
  originating_context: string;
  original_verdict: any;
  corrected_verdict: any;
}

export class CorrectionRecord {
  constructor(
    public tenant_id: string,
    public message_id: string,
    public verdict: VerdictSnapshot,
    public source: CorrectionSource,
    public state: 'candidate' | 'confirmed' | 'processed' = source === 'passive_inferred' ? 'candidate' : 'confirmed',
  ) {}

  isTrusted(): boolean {
    return this.source !== 'passive_inferred' || this.state === 'confirmed';
  }

  canReverseQuarantine(): boolean {
    return this.source === 'admin_override';
  }
}

export class SenderReputationCache {
  constructor(
    public tenant_id: string,
    public sender_domain: string,
    public category_confidence: Map<string, number> = new Map(),
    public last_updated: Date = new Date(),
  ) {}

  updateFromTrustedCorrection(category: string, confidence: number): void {
    if (confidence > 0.5) {
      this.category_confidence.set(category, confidence);
      this.last_updated = new Date();
    }
  }

  getConfidence(category: string): number {
    return this.category_confidence.get(category) || 0;
  }
}
