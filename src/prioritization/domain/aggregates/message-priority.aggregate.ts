import { ScoreComponent } from '../value-objects/score-component';
import { ScoringWeights } from '../value-objects/scoring-weights';

export type PriorityTier = 'Critical' | 'High' | 'Normal' | 'Low';

export interface MessagePriorityProps {
  tenantId: string;
  messageId: string;
  components: ScoreComponent[];
  score: number;
  tier: PriorityTier;
  isPendingSignals: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MessagePriority {
  readonly tenantId: string;
  readonly messageId: string;
  components: ScoreComponent[];
  score: number;
  tier: PriorityTier;
  isPendingSignals: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: MessagePriorityProps) {
    this.tenantId = props.tenantId;
    this.messageId = props.messageId;
    this.components = props.components;
    this.score = Math.max(0, Math.min(100, props.score));
    this.tier = props.tier;
    this.isPendingSignals = props.isPendingSignals;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static pending(tenantId: string, messageId: string): MessagePriority {
    return new MessagePriority({
      tenantId,
      messageId,
      components: [],
      score: 0,
      tier: 'Normal',
      isPendingSignals: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private static tierForScore(score: number): PriorityTier {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 30) return 'Normal';
    return 'Low';
  }

  computeScore(weights: ScoringWeights): { score: number; components: ScoreComponent[] } {
    if (this.components.length === 0) {
      return { score: 0, components: [] };
    }

    let total = 0;
    const weightedComponents: ScoreComponent[] = [];

    for (const comp of this.components) {
      let weight = 1;
      switch (comp.signal) {
        case 'VipStatus':
          weight = weights.vipWeight;
          break;
        case 'InteractionFrequency':
          weight = weights.frequencyWeight;
          break;
        case 'UrgencyLanguage':
          weight = weights.urgencyWeight;
          break;
        case 'CalendarProximity':
          weight = weights.calendarWeight;
          break;
        case 'NeedsReplyAging':
          weight = weights.needsReplyAgingWeight;
          break;
      }
      const contribution = Math.round(comp.contribution * weight);
      total += contribution;
      weightedComponents.push(
        new ScoreComponent(comp.signal, contribution, comp.evidence),
      );
    }

    const score = Math.max(0, Math.min(100, total));
    return { score, components: weightedComponents };
  }

  updateScore(newScore: number, components: ScoreComponent[]): PriorityTier | null {
    const oldTier = this.tier;
    const newScore_clamped = Math.max(0, Math.min(100, newScore));
    this.score = newScore_clamped;
    this.components = components;
    this.tier = MessagePriority.tierForScore(newScore_clamped);
    this.isPendingSignals = false;
    this.updatedAt = new Date();

    if (
      (oldTier === 'Normal' || oldTier === 'Low') &&
      (this.tier === 'High' || this.tier === 'Critical')
    ) {
      return this.tier;
    }
    return null;
  }

  addComponent(component: ScoreComponent): void {
    const existing = this.components.findIndex(c => c.signal === component.signal);
    if (existing >= 0) {
      this.components[existing] = component;
    } else {
      this.components.push(component);
    }
  }

  toJSON() {
    return {
      tenantId: this.tenantId,
      messageId: this.messageId,
      components: this.components.map(c => c.toJSON()),
      score: this.score,
      tier: this.tier,
      isPendingSignals: this.isPendingSignals,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json: any): MessagePriority {
    return new MessagePriority({
      tenantId: json.tenantId,
      messageId: json.messageId,
      components: (json.components || []).map((c: any) => ScoreComponent.fromJSON(c)),
      score: json.score,
      tier: json.tier,
      isPendingSignals: json.isPendingSignals,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt),
    });
  }
}
