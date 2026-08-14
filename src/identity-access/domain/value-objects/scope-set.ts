// Scope set value object enforcing minimal required scopes per platform
export class ScopeSet {
  private static readonly GMAIL_MIN_SCOPES = ['gmail.modify', 'gmail.labels'];
  private static readonly OUTLOOK_MIN_SCOPES = [
    'Mail.ReadWrite',
    'MailboxSettings.ReadWrite',
  ];

  constructor(private scopes: string[], private platform: 'gmail' | 'outlook') {
    this.validate();
  }

  private validate(): void {
    const minRequired =
      this.platform === 'gmail'
        ? ScopeSet.GMAIL_MIN_SCOPES
        : ScopeSet.OUTLOOK_MIN_SCOPES;

    const scopeSet = new Set(this.scopes);
    for (const required of minRequired) {
      if (!scopeSet.has(required)) {
        throw new Error(
          `Missing required scope for ${this.platform}: ${required}`,
        );
      }
    }

    const allowedScopes = new Set(minRequired);
    for (const scope of this.scopes) {
      if (!allowedScopes.has(scope)) {
        throw new Error(`Scope ${scope} exceeds minimal required set`);
      }
    }
  }

  static forGmail(scopes: string[]): ScopeSet {
    return new ScopeSet(scopes, 'gmail');
  }

  static forOutlook(scopes: string[]): ScopeSet {
    return new ScopeSet(scopes, 'outlook');
  }

  static minimalGmail(): ScopeSet {
    return new ScopeSet([...ScopeSet.GMAIL_MIN_SCOPES], 'gmail');
  }

  static minimalOutlook(): ScopeSet {
    return new ScopeSet([...ScopeSet.OUTLOOK_MIN_SCOPES], 'outlook');
  }

  toArray(): string[] {
    return [...this.scopes];
  }

  toJSON(): string[] {
    return this.toArray();
  }

  equals(other: ScopeSet): boolean {
    const thisSet = new Set(this.scopes);
    const otherSet = new Set(other.toArray());
    if (thisSet.size !== otherSet.size) return false;
    for (const scope of thisSet) {
      if (!otherSet.has(scope)) return false;
    }
    return true;
  }
}
