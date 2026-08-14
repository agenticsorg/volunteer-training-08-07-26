export interface AuthenticationSignal {
  spf_pass: boolean;
  dkim_pass: boolean;
  dmarc_pass: boolean;
  dmarc_aligned: boolean;
  brand_impersonation_detected: boolean;
}

export interface LookalikeScore {
  domain_similarity: number;
  homoglyph_detected: boolean;
  from_correspondence_history: boolean;
}

export interface IntentClassification {
  intent: 'credential_harvesting' | 'bec' | 'malware_delivery' | 'none';
  confidence: number;
}

export class ThreatAssessment {
  constructor(
    public tenant_id: string,
    public message_id: string,
    public auth_signal: AuthenticationSignal | null,
    public lookalike_score: LookalikeScore | null,
    public intent_classification: IntentClassification | null,
    public quarantine_locked: boolean = false,
  ) {}

  determineQuarantineNeed(): 'locked_quarantine' | 'soft_flag' | 'none' {
    const threat_score =
      (this.auth_signal && this.auth_signal.dmarc_pass && this.auth_signal.brand_impersonation_detected ? 0.6 : 0) +
      (this.lookalike_score && this.lookalike_score.domain_similarity > 0.8 ? 0.3 : 0) +
      (this.intent_classification && this.intent_classification.confidence > 0.8 ? 0.4 : 0);

    if (threat_score > 1.0) return 'locked_quarantine';
    if (threat_score > 0.5) return 'soft_flag';
    return 'none';
  }
}
