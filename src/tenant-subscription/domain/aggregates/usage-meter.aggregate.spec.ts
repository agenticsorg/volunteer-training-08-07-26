import { UsageMeter } from './usage-meter.aggregate';
import { UsageOverageDetected } from '../events/usage-overage-detected.event';

describe('UsageMeter Aggregate', () => {
  describe('atomic increment', () => {
    it('should increment usage count', () => {
      const now = new Date();
      const meter = new UsageMeter(
        'meter-1',
        'tenant-1',
        'llm_tokens',
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        BigInt(0),
        BigInt(10000),
        false,
      );

      meter.atomicIncrement(1000);

      expect(meter.usageCount).toBe(BigInt(1000));
      expect(meter.overageDetected).toBe(false);
      expect(meter.getUncommittedEvents().length).toBe(0);
    });

    it('should emit UsageOverageDetected exactly once when threshold crossed', () => {
      const now = new Date();
      const meter = new UsageMeter(
        'meter-1',
        'tenant-1',
        'llm_tokens',
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        BigInt(0),
        BigInt(1000),
        false,
      );

      meter.atomicIncrement(1000);

      expect(meter.usageCount).toBe(BigInt(1000));
      expect(meter.overageDetected).toBe(true);
      const events = meter.getUncommittedEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UsageOverageDetected);
    });

    it('should not emit event on second increment past threshold', () => {
      const now = new Date();
      const meter = new UsageMeter(
        'meter-1',
        'tenant-1',
        'llm_tokens',
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        BigInt(0),
        BigInt(1000),
        false,
      );

      meter.atomicIncrement(1000);
      meter.clearUncommittedEvents();

      meter.atomicIncrement(500);

      expect(meter.usageCount).toBe(BigInt(1500));
      expect(meter.overageDetected).toBe(true);
      expect(meter.getUncommittedEvents().length).toBe(0);
    });

    it('should not emit event if already flagged as overage detected', () => {
      const now = new Date();
      const meter = new UsageMeter(
        'meter-1',
        'tenant-1',
        'llm_tokens',
        now,
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
        BigInt(2000),
        BigInt(1000),
        true,
      );

      meter.atomicIncrement(1000);

      expect(meter.usageCount).toBe(BigInt(3000));
      expect(meter.getUncommittedEvents().length).toBe(0);
    });
  });
});
