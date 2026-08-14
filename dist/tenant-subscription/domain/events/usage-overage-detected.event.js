"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageOverageDetected = void 0;
const domain_event_1 = require("@common/domain/domain-event");
class UsageOverageDetected extends domain_event_1.DomainEvent {
    constructor(tenantId, meterType, billingPeriodStart, billingPeriodEnd, usage, threshold) {
        super();
        this.tenantId = tenantId;
        this.meterType = meterType;
        this.billingPeriodStart = billingPeriodStart;
        this.billingPeriodEnd = billingPeriodEnd;
        this.usage = usage;
        this.threshold = threshold;
    }
}
exports.UsageOverageDetected = UsageOverageDetected;
//# sourceMappingURL=usage-overage-detected.event.js.map