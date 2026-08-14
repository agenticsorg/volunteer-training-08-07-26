export interface FacetApplication {
  facet_type: 'category' | 'threat' | 'contact' | 'priority';
  desired_value: any;
  last_known_platform_state: any;
  last_applied_at: Date | null;
  application_failed: boolean;
}

export class MessageWriteBackState {
  constructor(
    public tenant_id: string,
    public mailbox_id: string,
    public message_id: string,
    public facets: Map<string, FacetApplication> = new Map(),
  ) {}

  isIdempotent(facet_type: string, desired_value: any): boolean {
    const facet = this.facets.get(facet_type);
    return !!(facet && JSON.stringify(facet.desired_value) === JSON.stringify(desired_value));
  }

  recordFacetApplication(facet_type: string, facet: FacetApplication): void {
    this.facets.set(facet_type, facet);
  }

  shouldSuppressFacetDisplay(facet_type: string): boolean {
    // If quarantine is active, suppress normal facet display
    const threat_facet = this.facets.get('threat');
    return !!(threat_facet && threat_facet.desired_value?.quarantine_locked === true && facet_type !== 'threat');
  }
}
