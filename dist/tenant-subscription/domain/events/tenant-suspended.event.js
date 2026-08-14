"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantSuspended = void 0;
const domain_event_1 = require("@common/domain/domain-event");
class TenantSuspended extends domain_event_1.DomainEvent {
    constructor(tenantId, reason) {
        super();
        this.tenantId = tenantId;
        this.reason = reason;
    }
}
exports.TenantSuspended = TenantSuspended;
//# sourceMappingURL=tenant-suspended.event.js.map