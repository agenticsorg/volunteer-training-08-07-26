"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageMeter = void 0;
const usage_overage_detected_event_1 = require("../events/usage-overage-detected.event");
class UsageMeter {
    constructor(id, tenantId, meterType, billingPeriodStart, billingPeriodEnd, usageCount = BigInt(0), overageThreshold, overageDetected = false, lastIncrementedAt) {
        this.id = id;
        this.tenantId = tenantId;
        this.meterType = meterType;
        this.billingPeriodStart = billingPeriodStart;
        this.billingPeriodEnd = billingPeriodEnd;
        this.usageCount = usageCount;
        this.overageThreshold = overageThreshold;
        this.overageDetected = overageDetected;
        this.lastIncrementedAt = lastIncrementedAt;
        this.uncommittedEvents = [];
    }
    atomicIncrement(amount) {
        const newCount = this.usageCount + BigInt(amount);
        // Only raise event once per threshold crossing
        if (!this.overageDetected && newCount >= this.overageThreshold) {
            this.overageDetected = true;
            this.uncommittedEvents.push(new usage_overage_detected_event_1.UsageOverageDetected(this.tenantId, this.meterType, this.billingPeriodStart, this.billingPeriodEnd, Number(newCount), Number(this.overageThreshold)));
        }
        this.usageCount = newCount;
        this.lastIncrementedAt = new Date();
    }
    getUncommittedEvents() {
        return this.uncommittedEvents;
    }
    clearUncommittedEvents() {
        this.uncommittedEvents = [];
    }
}
exports.UsageMeter = UsageMeter;
//# sourceMappingURL=usage-meter.aggregate.js.map