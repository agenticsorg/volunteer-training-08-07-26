"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanEntitlementsChanged = void 0;
const domain_event_1 = require("@common/domain/domain-event");
class PlanEntitlementsChanged extends domain_event_1.DomainEvent {
    constructor(tenantId, planId, entitlements, version) {
        super();
        this.tenantId = tenantId;
        this.planId = planId;
        this.entitlements = entitlements;
        this.version = version;
    }
}
exports.PlanEntitlementsChanged = PlanEntitlementsChanged;
//# sourceMappingURL=plan-entitlements-changed.event.js.map