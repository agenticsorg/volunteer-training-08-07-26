import {
  AuthenticationSignal,
  LookalikeScore,
  IntentClassification,
  QuarantineDecision,
  ThreatDetectionTier,
} from '../value-objects';

export interface ThreatAssessmentProps {
  tenantId: string;
  messageId: string;
  authenticationSignal: AuthenticationSignal | null;
  lookalikeScore: LookalikeScore | null;
  intentClassification: IntentClassification | null;
  quarantineDecision: QuarantineDecision;
  highestTierReached: ThreatTier;
  createdAt: Date;
  updatedAt: Date;
}

type ThreatTier = 'AuthCheck' | 'LookalikeCheck' | 'IntentLlm';

export class ThreatAssessment {
  readonly tenantId: string;
  readonly messageId: string;
  authenticationSignal: AuthenticationSignal | null;
  lookalikeScore: LookalikeScore | null;
  intentClassification: IntentClassification | null;
  quarantineDecision: QuarantineDecision;
  highestTierReached: ThreatTier;
  readonly createdAt: Date;
  updatedAt: Date;
  private assessmentLocked: boolean = false;

  constructor(props: ThreatAssessmentProps) {
    this.tenantId = props.tenantId;
    this.messageId = props.messageId;
    this.authenticationSignal = props.authenticationSignal;
    this.lookalikeScore = props.lookalikeScore;
    this.intentClassification = props.intentClassification;
    this.quarantineDecision = props.quarantineDecision;
    this.highestTierReached = props.highestTierReached;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.assessmentLocked = props.quarantineDecision.isLocked();
  }

  static create(tenantId: string, messageId: string): ThreatAssessment {
    return new ThreatAssessment({
      tenantId,
      messageId,
      authenticationSignal: null,
      lookalikeScore: null,
      intentClassification: null,
      quarantineDecision: QuarantineDecision.none(),
      highestTierReached: 'AuthCheck',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  assessAuthentication(signal: AuthenticationSignal): void {
    if (this.assessmentLocked) {
      throw new Error('Assessment is locked and cannot be modified');
    }
    this.authenticationSignal = signal;
    this.highestTierReached = 'AuthCheck';
    this.updatedAt = new Date();

    // Check if auth signals alone produce a verdict
    if (signal.isHighRisk()) {
      this.quarantineDecision = QuarantineDecision.quarantine('policy');
      this.assessmentLocked = true;
    }
  }

  assessLookalike(score: LookalikeScore): void {
    if (this.assessmentLocked) {
      throw new Error('Assessment is locked and cannot be modified');
    }
    this.lookalikeScore = score;
    this.highestTierReached = 'LookalikeCheck';
    this.updatedAt = new Date();

    // Check if lookalike + auth produces a verdict
    if (
      score.isHighRisk() &&
      this.authenticationSignal?.isHighRisk()
    ) {
      this.quarantineDecision = QuarantineDecision.quarantine('policy');
      this.assessmentLocked = true;
    } else if (score.isHighRisk()) {
      this.quarantineDecision = QuarantineDecision.flag();
    }
  }

  assessIntentClassification(intent: IntentClassification): void {
    if (this.assessmentLocked) {
      throw new Error('Assessment is locked and cannot be modified');
    }
    this.intentClassification = intent;
    this.highestTierReached = 'IntentLlm';
    this.updatedAt = new Date();

    // Only invoke intent layer if earlier layers didn't yield high-confidence
    if (intent.isHighConfidence()) {
      this.quarantineDecision = QuarantineDecision.quarantine('policy');
      this.assessmentLocked = true;
    } else if (intent.intent !== 'None' && intent.confidence >= 0.5) {
      this.quarantineDecision = QuarantineDecision.flag();
    }
  }

  overrideQuarantine(newDecision: QuarantineDecision): void {
    if (!this.assessmentLocked) {
      throw new Error('Can only override a locked quarantine');
    }
    if (newDecision.decidedBy !== 'admin' && newDecision.decidedBy !== 'user') {
      throw new Error('Overrides must be from admin or user, not policy');
    }
    this.quarantineDecision = newDecision;
    this.assessmentLocked = false;
    this.updatedAt = new Date();
  }

  isAssessmentComplete(): boolean {
    return this.authenticationSignal !== null &&
      this.lookalikeScore !== null &&
      this.intentClassification !== null;
  }

  toJSON() {
    return {
      tenantId: this.tenantId,
      messageId: this.messageId,
      authenticationSignal: this.authenticationSignal?.toJSON() ?? null,
      lookalikeScore: this.lookalikeScore?.toJSON() ?? null,
      intentClassification: this.intentClassification?.toJSON() ?? null,
      quarantineDecision: this.quarantineDecision.toJSON(),
      highestTierReached: this.highestTierReached,
      assessmentLocked: this.assessmentLocked,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json: any): ThreatAssessment {
    return new ThreatAssessment({
      tenantId: json.tenantId,
      messageId: json.messageId,
      authenticationSignal: json.authenticationSignal
        ? AuthenticationSignal.fromJSON(json.authenticationSignal)
        : null,
      lookalikeScore: json.lookalikeScore
        ? LookalikeScore.fromJSON(json.lookalikeScore)
        : null,
      intentClassification: json.intentClassification
        ? IntentClassification.fromJSON(json.intentClassification)
        : null,
      quarantineDecision: QuarantineDecision.fromJSON(json.quarantineDecision),
      highestTierReached: json.highestTierReached,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt),
    });
  }
}
