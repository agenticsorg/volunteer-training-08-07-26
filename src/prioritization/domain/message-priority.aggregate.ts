export interface ScoreComponent {
  name: string;
  value: number;
  weight: number;
}

export class MessagePriority {
  constructor(
    public tenant_id: string,
    public message_id: string,
    public priority_score: number = 0,
    public components: ScoreComponent[] = [],
  ) {}

  computeScore(components: ScoreComponent[]): void {
    this.components = components;
    let total = 0;
    for (const comp of components) {
      total += Math.min(100, comp.value * comp.weight);
    }
    this.priority_score = Math.min(100, Math.max(0, total));
  }

  isIdempotent(prevScore: number): boolean {
    return Math.abs(this.priority_score - prevScore) < 0.01;
  }
}
