export type CorrectionSource = 'passive_inferred' | 'explicit_user_action' | 'admin_override';
export type CorrectionState = 'candidate' | 'confirmed' | 'processed';

export class CorrectionEvidence {
  constructor(
    public readonly source: CorrectionSource,
    public readonly observedAt: Date,
    public readonly corroborationCount: number = 0,
  ) {}

  isHighTrust(): boolean {
    return this.source !== 'passive_inferred';
  }

  requiresAdminOverride(): boolean {
    return this.source === 'admin_override';
  }

  toDb(): Record<string, any> {
    return {
      source: this.source,
      observedAt: this.observedAt,
      corroborationCount: this.corroborationCount,
    };
  }

  static fromDb(data: any): CorrectionEvidence {
    return new CorrectionEvidence(
      data.source,
      data.observedAt,
      data.corroborationCount,
    );
  }

  withAdditionalCorroboration(): CorrectionEvidence {
    return new CorrectionEvidence(
      this.source,
      this.observedAt,
      this.corroborationCount + 1,
    );
  }
}
