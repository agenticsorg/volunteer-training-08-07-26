export class SyncCursor {
  constructor(
    readonly platform: 'gmail' | 'outlook',
    readonly value: string,
  ) {}
  
  canAdvanceTo(newValue: string): boolean {
    if (this.platform === 'gmail') {
      const oldNum = parseInt(this.value, 10);
      const newNum = parseInt(newValue, 10);
      return newNum >= oldNum;
    }
    if (this.platform === 'outlook') {
      return newValue !== this.value;
    }
    return false;
  }
}
