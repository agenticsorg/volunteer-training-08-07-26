"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxAuthorizedEvent = void 0;
class MailboxAuthorizedEvent {
    constructor(tenantId, userId, mailboxId, platform, scopes, timestamp = new Date()) {
        this.tenantId = tenantId;
        this.userId = userId;
        this.mailboxId = mailboxId;
        this.platform = platform;
        this.scopes = scopes;
        this.timestamp = timestamp;
    }
}
exports.MailboxAuthorizedEvent = MailboxAuthorizedEvent;
//# sourceMappingURL=mailbox-authorized.event.js.map