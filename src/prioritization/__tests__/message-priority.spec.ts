import { MessagePriority } from '../domain/aggregates/message-priority.aggregate';
import { ScoreComponent } from '../domain/value-objects/score-component';
import { ScoringWeights } from '../domain/value-objects/scoring-weights';

describe('MessagePriority Aggregate', () => {
  it('should create pending priority', () => {
    const priority = MessagePriority.pending('tenant-1', 'msg-123');
    expect(priority.isPendingSignals).toBe(true);
    expect(priority.score).toBe(0);
    expect(priority.tier).toBe('Normal');
  });

  it('should compute score with default weights', () => {
    const priority = MessagePriority.pending('tenant-1', 'msg-123');
    priority.addComponent(new ScoreComponent('VipStatus', 100, 'VIP sender'));
    priority.addComponent(new ScoreComponent('InteractionFrequency', 50, 'Frequent'));
    priority.addComponent(new ScoreComponent('UrgencyLanguage', 30, 'Urgent'));
    priority.addComponent(new ScoreComponent('CalendarProximity', 20, 'Soon'));
    priority.addComponent(new ScoreComponent('NeedsReplyAging', 60, 'Overdue'));

    const weights = ScoringWeights.defaults();
    const { score } = priority.computeScore(weights);
    
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should clamp score to [0, 100]', () => {
    const priority = new MessagePriority({
      tenantId: 'tenant-1',
      messageId: 'msg-123',
      components: [],
      score: 150,
      tier: 'Critical',
      isPendingSignals: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(priority.score).toBe(100);
  });

  it('should assign correct tier based on score', () => {
    const scenarios = [
      { score: 85, expectedTier: 'Critical' },
      { score: 65, expectedTier: 'High' },
      { score: 35, expectedTier: 'Normal' },
      { score: 10, expectedTier: 'Low' },
    ];

    for (const { score, expectedTier } of scenarios) {
      const priority = new MessagePriority({
        tenantId: 'tenant-1',
        messageId: 'msg-123',
        components: [],
        score,
        tier: 'Normal',
        isPendingSignals: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Manually update to test tier assignment
      priority.updateScore(score, []);
      expect(priority.tier).toBe(expectedTier);
    }
  });

  it('should detect escalation when crossing to High/Critical', () => {
    const priority = new MessagePriority({
      tenantId: 'tenant-1',
      messageId: 'msg-123',
      components: [],
      score: 20,
      tier: 'Low',
      isPendingSignals: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const escalated = priority.updateScore(75, []);
    expect(escalated).toBe('High');
    expect(priority.tier).toBe('High');
  });

  it('should not detect escalation for same tier', () => {
    const priority = new MessagePriority({
      tenantId: 'tenant-1',
      messageId: 'msg-123',
      components: [],
      score: 65,
      tier: 'High',
      isPendingSignals: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const escalated = priority.updateScore(70, []);
    expect(escalated).toBeNull();
  });

  it('should be idempotent with same inputs', () => {
    const weights = ScoringWeights.defaults();
    const components = [
      new ScoreComponent('VipStatus', 80, 'VIP'),
      new ScoreComponent('InteractionFrequency', 50, 'Frequent'),
      new ScoreComponent('UrgencyLanguage', 40, 'Important'),
    ];

    const priority1 = MessagePriority.pending('tenant-1', 'msg-123');
    components.forEach(c => priority1.addComponent(c));
    const { score: score1 } = priority1.computeScore(weights);

    const priority2 = MessagePriority.pending('tenant-1', 'msg-123');
    components.forEach(c => priority2.addComponent(c));
    const { score: score2 } = priority2.computeScore(weights);

    expect(score1).toBe(score2);
  });

  it('should serialize and deserialize', () => {
    const priority = new MessagePriority({
      tenantId: 'tenant-1',
      messageId: 'msg-123',
      components: [new ScoreComponent('VipStatus', 80, 'VIP')],
      score: 50,
      tier: 'Normal',
      isPendingSignals: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    });

    const json = priority.toJSON();
    const restored = MessagePriority.fromJSON(json);

    expect(restored.tenantId).toBe(priority.tenantId);
    expect(restored.messageId).toBe(priority.messageId);
    expect(restored.score).toBe(priority.score);
    expect(restored.components.length).toBe(1);
  });
});
