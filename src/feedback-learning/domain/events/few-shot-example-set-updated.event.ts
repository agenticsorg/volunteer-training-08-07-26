export class FewShotExampleSetUpdated {
  constructor(
    public readonly tenantId: string | null,
    public readonly category: string,
    public readonly exampleSetVersion: string,
    public readonly updatedAt: Date,
  ) {}
}
