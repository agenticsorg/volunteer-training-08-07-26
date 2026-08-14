export type QuarantineAction = 'Flag' | 'Quarantine' | 'None';
export type DecisionMaker = 'policy' | 'admin' | 'user';

export class QuarantineDecision {
  readonly action: QuarantineAction;
  readonly decidedBy: DecisionMaker;
  readonly decidedAt: Date;
  readonly reversible: boolean;

  constructor(props: {
    action: QuarantineAction;
    decidedBy: DecisionMaker;
    decidedAt: Date;
    reversible: boolean;
  }) {
    this.action = props.action;
    this.decidedBy = props.decidedBy;
    this.decidedAt = props.decidedAt;
    this.reversible = props.reversible;
  }

  static none(): QuarantineDecision {
    return new QuarantineDecision({
      action: 'None',
      decidedBy: 'policy',
      decidedAt: new Date(),
      reversible: true,
    });
  }

  static flag(): QuarantineDecision {
    return new QuarantineDecision({
      action: 'Flag',
      decidedBy: 'policy',
      decidedAt: new Date(),
      reversible: true,
    });
  }

  static quarantine(decidedBy: DecisionMaker = 'policy'): QuarantineDecision {
    return new QuarantineDecision({
      action: 'Quarantine',
      decidedBy,
      decidedAt: new Date(),
      reversible: decidedBy !== 'policy', // Only policy-driven quarantines are reversible by admin
    });
  }

  isLocked(): boolean {
    return this.action === 'Quarantine' && !this.reversible;
  }

  toJSON() {
    return {
      action: this.action,
      decidedBy: this.decidedBy,
      decidedAt: this.decidedAt.toISOString(),
      reversible: this.reversible,
    };
  }

  static fromJSON(json: any): QuarantineDecision {
    return new QuarantineDecision({
      action: json.action ?? 'None',
      decidedBy: json.decidedBy ?? 'policy',
      decidedAt: new Date(json.decidedAt),
      reversible: json.reversible ?? true,
    });
  }
}
