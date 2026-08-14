"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEvent = void 0;
class DomainEvent {
    constructor() {
        this.occurredAt = new Date();
        this.eventId = crypto.randomUUID();
    }
}
exports.DomainEvent = DomainEvent;
//# sourceMappingURL=domain-event.js.map