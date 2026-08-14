export declare class SyncCursor {
    readonly platform: 'gmail' | 'outlook';
    readonly value: string;
    constructor(platform: 'gmail' | 'outlook', value: string);
    canAdvanceTo(newValue: string): boolean;
}
//# sourceMappingURL=sync-cursor.d.ts.map