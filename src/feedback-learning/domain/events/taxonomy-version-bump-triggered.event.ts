export class TaxonomyVersionBumpTriggered {
  constructor(
    public readonly tenantId: string | null,
    public readonly reason: string,
    public readonly proposedVersion: string,
  ) {}
}
