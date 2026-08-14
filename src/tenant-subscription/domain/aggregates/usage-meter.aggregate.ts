import { UsageOverageDetected } from '../events/usage-overage-detected.event';

export class UsageMeter {
  private uncommittedEvents: any[] = [];

  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly meterType: string,
    public readonly billingPeriodStart: Date,
    public readonly billingPeriodEnd: Date,
    public usageCount: bigint = BigInt(0),
    public readonly overageThreshold: bigint,
    public overageDetected: boolean = false,
    public lastIncrementedAt?: Date,
  ) {}

  atomicIncrement(amount: number): void {
    const newCount = this.usageCount + BigInt(amount);

    // Only raise event once per threshold crossing
    if (!this.overageDetected && newCount >= this.overageThreshold) {
      this.overageDetected = true;
      this.uncommittedEvents.push(
        new UsageOverageDetected(
          this.tenantId,
          this.meterType,
          this.billingPeriodStart,
          this.billingPeriodEnd,
          Number(newCount),
          Number(this.overageThreshold),
        ),
      );
    }

    this.usageCount = newCount;
    this.lastIncrementedAt = new Date();
  }

  getUncommittedEvents(): any[] {
    return this.uncommittedEvents;
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }
}
