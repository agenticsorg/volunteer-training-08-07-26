"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchSubscriptionExpiringEvent = exports.MailboxSyncFailedEvent = exports.MessageIngestedEvent = void 0;
class MessageIngestedEvent {
    constructor(messageId, tenantId, mailboxId, platform, normalizedEnvelope, timestamp = new Date()) {
        this.messageId = messageId;
        this.tenantId = tenantId;
        this.mailboxId = mailboxId;
        this.platform = platform;
        this.normalizedEnvelope = normalizedEnvelope;
        this.timestamp = timestamp;
    }
}
exports.MessageIngestedEvent = MessageIngestedEvent;
class MailboxSyncFailedEvent {
    constructor(tenantId, mailboxId, reason, timestamp = new Date()) {
        this.tenantId = tenantId;
        this.mailboxId = mailboxId;
        this.reason = reason;
        this.timestamp = timestamp;
    }
}
exports.MailboxSyncFailedEvent = MailboxSyncFailedEvent;
class WatchSubscriptionExpiringEvent {
    constructor(mailboxId, platform, timestamp = new Date()) {
        this.mailboxId = mailboxId;
        this.platform = platform;
        this.timestamp = timestamp;
    }
}
exports.WatchSubscriptionExpiringEvent = WatchSubscriptionExpiringEvent;
//# sourceMappingURL=message-ingested.event.js.map