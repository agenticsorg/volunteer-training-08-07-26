"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterAdapter = void 0;
const common_1 = require("@nestjs/common");
let RateLimiterAdapter = class RateLimiterAdapter {
    constructor() {
        this.counters = new Map();
        this.resetTimers = [];
    }
    async enforceQuota(platform, tenantId, mailboxId, units) {
        const key = `ratelimit:${platform}:${tenantId}:${mailboxId}`;
        const limits = {
            gmail: 250,
            outlook: 333,
        };
        const limit = limits[platform] || 100;
        const current = (this.counters.get(key) || 0) + 1;
        this.counters.set(key, current);
        if (current === 1) {
            const timer = setTimeout(() => {
                this.counters.delete(key);
            }, 1000);
            this.resetTimers.push(timer);
        }
        return current <= limit;
    }
    async getCurrentUsage(platform, tenantId, mailboxId) {
        const key = `ratelimit:${platform}:${tenantId}:${mailboxId}`;
        return this.counters.get(key) || 0;
    }
    onModuleDestroy() {
        this.resetTimers.forEach(timer => clearTimeout(timer));
    }
};
exports.RateLimiterAdapter = RateLimiterAdapter;
exports.RateLimiterAdapter = RateLimiterAdapter = __decorate([
    (0, common_1.Injectable)()
], RateLimiterAdapter);
//# sourceMappingURL=rate-limiter.adapter.js.map