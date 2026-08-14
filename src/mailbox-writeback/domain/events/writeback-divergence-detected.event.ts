import { FacetType } from '../value-objects/facet-application';

export class WriteBackDivergenceDetected {
  constructor(
    public readonly tenantId: string,
    public readonly mailboxId: string,
    public readonly messageId: string,
    public readonly facetType: FacetType,
    public readonly expectedState: any,
    public readonly observedState: any,
    public readonly observedAt: Date,
  ) {}
}
