"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subscription = void 0;
const plan_entitlements_changed_event_1 = require("../events/plan-entitlements-changed.event");
const tenant_suspended_event_1 = require("../events/tenant-suspended.event");
class Subscription {
    constructor(id, tenantId, currentPlanId, status, planVersion = 1, planChangedAt, stripeCustomerId, stripeSubscriptionId) {
        this.id = id;
        this.tenantId = tenantId;
        this.currentPlanId = currentPlanId;
        this.status = status;
        this.planVersion = planVersion;
        this.planChangedAt = planChangedAt;
        this.stripeCustomerId = stripeCustomerId;
        this.stripeSubscriptionId = stripeSubscriptionId;
        this.uncommittedEvents = [];
    }
    changePlan(newPlanId, entitlements) {
        if (this.currentPlanId === newPlanId)
            return;
        this.currentPlanId = newPlanId;
        this.planVersion += 1;
        this.planChangedAt = new Date();
        this.uncommittedEvents.push(new plan_entitlements_changed_event_1.PlanEntitlementsChanged(this.tenantId, newPlanId, entitlements, this.planVersion));
    }
    markPastDue() {
        this.status = 'past_due';
        this.uncommittedEvents.push(new tenant_suspended_event_1.TenantSuspended(this.tenantId, 'payment_failed'));
    }
    suspend(reason) {
        this.status = 'suspended';
        this.uncommittedEvents.push(new tenant_suspended_event_1.TenantSuspended(this.tenantId, reason));
    }
    unsuspend() {
        if (this.status === 'suspended') {
            this.status = 'active';
        }
    }
    getUncommittedEvents() {
        return this.uncommittedEvents;
    }
    clearUncommittedEvents() {
        this.uncommittedEvents = [];
    }
}
exports.Subscription = Subscription;
//# sourceMappingURL=subscription.aggregate.js.map