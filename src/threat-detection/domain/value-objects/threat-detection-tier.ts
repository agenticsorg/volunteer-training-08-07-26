export type ThreatTier = 'AuthCheck' | 'LookalikeCheck' | 'IntentLlm';

export class ThreatDetectionTier {
  readonly tier: ThreatTier;
  readonly reachedAt: Date;

  constructor(props: {
    tier: ThreatTier;
    reachedAt: Date;
  }) {
    this.tier = props.tier;
    this.reachedAt = props.reachedAt;
  }

  static authCheck(): ThreatDetectionTier {
    return new ThreatDetectionTier({
      tier: 'AuthCheck',
      reachedAt: new Date(),
    });
  }

  static lookalikeCheck(): ThreatDetectionTier {
    return new ThreatDetectionTier({
      tier: 'LookalikeCheck',
      reachedAt: new Date(),
    });
  }

  static intentLlm(): ThreatDetectionTier {
    return new ThreatDetectionTier({
      tier: 'IntentLlm',
      reachedAt: new Date(),
    });
  }

  toJSON() {
    return {
      tier: this.tier,
      reachedAt: this.reachedAt.toISOString(),
    };
  }

  static fromJSON(json: any): ThreatDetectionTier {
    return new ThreatDetectionTier({
      tier: json.tier ?? 'AuthCheck',
      reachedAt: new Date(json.reachedAt),
    });
  }
}
