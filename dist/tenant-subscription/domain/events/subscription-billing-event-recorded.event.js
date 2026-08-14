"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionBillingEventRecorded = void 0;
const domain_event_1 = require("@common/domain/domain-event");
class SubscriptionBillingEventRecorded extends domain_event_1.DomainEvent {
    constructor(tenantId, eventType, stripeEventId, payload) {
        super();
        this.tenantId = tenantId;
        this.eventType = eventType;
        this.stripeEventId = stripeEventId;
        this.payload = payload;
    }
}
exports.SubscriptionBillingEventRecorded = SubscriptionBillingEventRecorded;
//# sourceMappingURL=subscription-billing-event-recorded.event.js.map