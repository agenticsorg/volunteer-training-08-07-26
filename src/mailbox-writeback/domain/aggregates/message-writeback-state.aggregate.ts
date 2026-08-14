import { FacetApplication, FacetType } from '../value-objects/facet-application';
import { FacetAppliedToPlatform } from '../events/facet-applied-to-platform.event';
import { WriteBackFailed } from '../events/writeback-failed.event';
import { WriteBackDivergenceDetected } from '../events/writeback-divergence-detected.event';
import { WriteBackFailureReason } from '../value-objects/writeback-failure-reason';

export type DomainEvent =
  | FacetAppliedToPlatform
  | WriteBackFailed
  | WriteBackDivergenceDetected;

export class MessageWriteBackState {
  private facets: Map<FacetType, FacetApplication> = new Map();
  private quarantineActive = false;
  private domainEvents: DomainEvent[] = [];

  constructor(
    public readonly tenantId: string,
    public readonly mailboxId: string,
    public readonly messageId: string,
    facetsData?: Record<string, any>,
  ) {
    if (facetsData) {
      Object.entries(facetsData).forEach(([facetType, data]) => {
        this.facets.set(
          facetType as FacetType,
          FacetApplication.fromDb(data),
        );
      });
      this.updateQuarantineStatus();
    }
  }

  static create(
    tenantId: string,
    mailboxId: string,
    messageId: string,
  ): MessageWriteBackState {
    return new MessageWriteBackState(tenantId, mailboxId, messageId);
  }

  recordFacetApplication(facet: FacetApplication): void {
    this.facets.set(facet.facetType, facet);
    this.updateQuarantineStatus();
  }

  applyFacet(
    facetType: FacetType,
    desiredValue: any,
    platform: 'gmail' | 'outlook',
    now: Date,
  ): void {
    const existing = this.facets.get(facetType);

    if (existing) {
      // Check if we're reapplying the same value
      if (
        JSON.stringify(existing.desiredValue) === JSON.stringify(desiredValue)
      ) {
        // If already applied, this is idempotent - no event needed
        if (existing.status === 'applied') {
          return;
        }
      }
    }

    // Apply the new facet value
    const facet =
      existing || FacetApplication.create(facetType, desiredValue);
    this.facets.set(facetType, facet.withStatus('applied', now));
    this.domainEvents.push(
      new FacetAppliedToPlatform(
        this.tenantId,
        this.mailboxId,
        this.messageId,
        facetType,
        platform,
        now,
      ),
    );
  }

  recordFacetFailure(
    facetType: FacetType,
    reason: WriteBackFailureReason,
    now: Date,
  ): void {
    const existing = this.facets.get(facetType);
    const facet = existing || FacetApplication.create(facetType, {});
    const updated = facet.withStatus('failed', now);
    this.facets.set(facetType, updated);

    this.domainEvents.push(
      new WriteBackFailed(
        this.tenantId,
        this.mailboxId,
        this.messageId,
        facetType,
        reason,
        updated.retryCount,
      ),
    );
  }

  detectDivergence(
    facetType: FacetType,
    observedPlatformState: any,
    now: Date,
  ): void {
    const facet = this.facets.get(facetType);
    if (
      !facet ||
      JSON.stringify(facet.lastKnownPlatformState) ===
        JSON.stringify(observedPlatformState)
    ) {
      return;
    }

    this.domainEvents.push(
      new WriteBackDivergenceDetected(
        this.tenantId,
        this.mailboxId,
        this.messageId,
        facetType,
        facet.lastKnownPlatformState,
        observedPlatformState,
        now,
      ),
    );

    this.facets.set(
      facetType,
      facet.withPlatformState(observedPlatformState),
    );
  }

  shouldSuppressFacet(facetType: FacetType): boolean {
    if (!this.quarantineActive || facetType === 'threat') {
      return false;
    }
    return true;
  }

  getFacet(facetType: FacetType): FacetApplication | undefined {
    return this.facets.get(facetType);
  }

  getAllFacets(): Map<FacetType, FacetApplication> {
    return new Map(this.facets);
  }

  toDb(): Record<string, any> {
    const facetsDb: Record<string, any> = {};
    this.facets.forEach((facet, facetType) => {
      facetsDb[facetType] = facet.toDb();
    });
    return facetsDb;
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  private updateQuarantineStatus(): void {
    const threatFacet = this.facets.get('threat');
    this.quarantineActive =
      threatFacet?.desiredValue?.quarantined === true ||
      threatFacet?.desiredValue?.quarantine_locked === true;
  }
}
