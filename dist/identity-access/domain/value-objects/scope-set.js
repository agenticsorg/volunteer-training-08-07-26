"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeSet = void 0;
// Scope set value object enforcing minimal required scopes per platform
class ScopeSet {
    constructor(scopes, platform) {
        this.scopes = scopes;
        this.platform = platform;
        this.validate();
    }
    validate() {
        const minRequired = this.platform === 'gmail'
            ? ScopeSet.GMAIL_MIN_SCOPES
            : ScopeSet.OUTLOOK_MIN_SCOPES;
        const scopeSet = new Set(this.scopes);
        for (const required of minRequired) {
            if (!scopeSet.has(required)) {
                throw new Error(`Missing required scope for ${this.platform}: ${required}`);
            }
        }
        const allowedScopes = new Set(minRequired);
        for (const scope of this.scopes) {
            if (!allowedScopes.has(scope)) {
                throw new Error(`Scope ${scope} exceeds minimal required set`);
            }
        }
    }
    static forGmail(scopes) {
        return new ScopeSet(scopes, 'gmail');
    }
    static forOutlook(scopes) {
        return new ScopeSet(scopes, 'outlook');
    }
    static minimalGmail() {
        return new ScopeSet([...ScopeSet.GMAIL_MIN_SCOPES], 'gmail');
    }
    static minimalOutlook() {
        return new ScopeSet([...ScopeSet.OUTLOOK_MIN_SCOPES], 'outlook');
    }
    toArray() {
        return [...this.scopes];
    }
    toJSON() {
        return this.toArray();
    }
    equals(other) {
        const thisSet = new Set(this.scopes);
        const otherSet = new Set(other.toArray());
        if (thisSet.size !== otherSet.size)
            return false;
        for (const scope of thisSet) {
            if (!otherSet.has(scope))
                return false;
        }
        return true;
    }
}
exports.ScopeSet = ScopeSet;
ScopeSet.GMAIL_MIN_SCOPES = ['gmail.modify', 'gmail.labels'];
ScopeSet.OUTLOOK_MIN_SCOPES = [
    'Mail.ReadWrite',
    'MailboxSettings.ReadWrite',
];
//# sourceMappingURL=scope-set.js.map