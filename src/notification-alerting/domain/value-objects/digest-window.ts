export type Cadence = 'daily' | 'weekly';

export class DigestWindow {
  constructor(
    public readonly windowStart: Date,
    public readonly windowEnd: Date,
    public readonly cadence: Cadence,
  ) {}

  static daily(endDate: Date = new Date()): DigestWindow {
    const start = new Date(endDate);
    start.setDate(start.getDate() - 1);
    return new DigestWindow(start, endDate, 'daily');
  }

  static weekly(endDate: Date = new Date()): DigestWindow {
    const start = new Date(endDate);
    start.setDate(start.getDate() - 7);
    return new DigestWindow(start, endDate, 'weekly');
  }

  static custom(start: Date, end: Date, cadence: Cadence): DigestWindow {
    return new DigestWindow(start, end, cadence);
  }

  durationDays(): number {
    return Math.floor(
      (this.windowEnd.getTime() - this.windowStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );
  }

  containsDate(date: Date): boolean {
    return date >= this.windowStart && date <= this.windowEnd;
  }

  toDb(): Record<string, any> {
    return {
      windowStart: this.windowStart,
      windowEnd: this.windowEnd,
      cadence: this.cadence,
    };
  }

  static fromDb(data: any): DigestWindow {
    return new DigestWindow(data.windowStart, data.windowEnd, data.cadence);
  }
}
