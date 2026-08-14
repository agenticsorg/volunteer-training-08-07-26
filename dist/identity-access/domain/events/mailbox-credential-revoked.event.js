"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxCredentialRevokedEvent = void 0;
class MailboxCredentialRevokedEvent {
    constructor(tenantId, mailboxId, platform, reason, timestamp = new Date()) {
        this.tenantId = tenantId;
        this.mailboxId = mailboxId;
        this.platform = platform;
        this.reason = reason;
        this.timestamp = timestamp;
    }
}
exports.MailboxCredentialRevokedEvent = MailboxCredentialRevokedEvent;
//# sourceMappingURL=mailbox-credential-revoked.event.js.map