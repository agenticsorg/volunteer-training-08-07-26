export declare class ScopeSet {
    private scopes;
    private platform;
    private static readonly GMAIL_MIN_SCOPES;
    private static readonly OUTLOOK_MIN_SCOPES;
    constructor(scopes: string[], platform: 'gmail' | 'outlook');
    private validate;
    static forGmail(scopes: string[]): ScopeSet;
    static forOutlook(scopes: string[]): ScopeSet;
    static minimalGmail(): ScopeSet;
    static minimalOutlook(): ScopeSet;
    toArray(): string[];
    toJSON(): string[];
    equals(other: ScopeSet): boolean;
}
//# sourceMappingURL=scope-set.d.ts.map