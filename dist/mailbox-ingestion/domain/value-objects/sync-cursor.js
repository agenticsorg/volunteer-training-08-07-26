"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncCursor = void 0;
class SyncCursor {
    constructor(platform, value) {
        this.platform = platform;
        this.value = value;
    }
    canAdvanceTo(newValue) {
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
exports.SyncCursor = SyncCursor;
//# sourceMappingURL=sync-cursor.js.map