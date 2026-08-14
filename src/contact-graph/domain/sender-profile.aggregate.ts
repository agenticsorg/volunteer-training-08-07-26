export interface ContactSignal {
  automation_header_absent: boolean;
  from_address_valid: boolean;
  contacts_api_match: boolean;
  bidirectional_thread_history: boolean;
  display_name_personal: boolean;
}

export interface ContactClassification {
  classification: 'personal' | 'automated';
  confidence: number;
  signals: ContactSignal;
}

export class SenderProfile {
  constructor(
    public tenant_id: string,
    public mailbox_id: string,
    public sender_address: string,
    public classification: ContactClassification,
    public interaction_count: number = 0,
    public bidirectional_interactions: number = 0,
    public is_vip: boolean = false,
    public vip_auto_promoted: boolean = false,
    public last_interaction: Date = new Date(),
  ) {}

  classifyFromSignals(signals: ContactSignal, hasThreadHistory: boolean): void {
    const weights = {
      automation_header_absent: 0.4,
      from_address_valid: 0.2,
      contacts_api_match: 0.4,
      bidirectional_thread_history: 0.4,
      display_name_personal: 0.1,
    };

    let score = 0;
    let totalWeight = 0;

    if (signals.automation_header_absent) {
      score += weights.automation_header_absent;
      totalWeight += weights.automation_header_absent;
    }
    if (signals.from_address_valid) {
      score += weights.from_address_valid;
      totalWeight += weights.from_address_valid;
    }
    if (signals.contacts_api_match) {
      score += weights.contacts_api_match;
      totalWeight += weights.contacts_api_match;
    }
    if (hasThreadHistory && signals.bidirectional_thread_history) {
      score += weights.bidirectional_thread_history;
      totalWeight += weights.bidirectional_thread_history;
    }
    if (signals.display_name_personal) {
      score += weights.display_name_personal;
      totalWeight += weights.display_name_personal;
    }

    const confidence = totalWeight > 0 ? score / totalWeight : 0;
    this.classification = {
      classification: confidence > 0.5 ? 'personal' : 'automated',
      confidence,
      signals,
    };
  }

  promoteToVipIfQualified(min_bidirectional: number, window_days: number): boolean {
    if (this.is_vip) return false;
    if (this.bidirectional_interactions >= min_bidirectional) {
      this.is_vip = true;
      this.vip_auto_promoted = true;
      return true;
    }
    return false;
  }
}
