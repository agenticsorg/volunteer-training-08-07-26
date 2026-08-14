export class DigestGenerated {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly digestWindow: { windowStart: Date; windowEnd: Date },
    public readonly itemCounts: Record<string, number>,
    public readonly generatedAt: Date,
  ) {}
}
