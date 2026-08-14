import { FacetType } from '../value-objects/facet-application';

export class FacetAppliedToPlatform {
  constructor(
    public readonly tenantId: string,
    public readonly mailboxId: string,
    public readonly messageId: string,
    public readonly facetType: FacetType,
    public readonly platform: 'gmail' | 'outlook',
    public readonly appliedAt: Date,
  ) {}
}
