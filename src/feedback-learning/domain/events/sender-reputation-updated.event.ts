export class SenderReputationUpdated {
  constructor(
    public readonly tenantId: string,
    public readonly senderDomain: string,
    public readonly category: string,
    public readonly confidenceWeight: number,
    public readonly updatedAt: Date,
  ) {}
}
