export class SyncCursor {
  constructor(
    readonly platform: 'gmail' | 'outlook',
    readonly value: string,
  ) {}
  
  canAdvanceTo(newValue: string): boolean {
    if (this.platform === 'gmail') {
      const oldNum = parseInt(this.value, 10);
      const newNum = parseInt(newValue, 10);
      // If old cursor is invalid/unset (NaN), allow advance to any valid new value (fail-open)
      if (isNaN(oldNum)) {
        return !isNaN(newNum);
      }
      return newNum >= oldNum;
    }
    if (this.platform === 'outlook') {
      return newValue !== this.value;
    }
    return false;
  }
}
