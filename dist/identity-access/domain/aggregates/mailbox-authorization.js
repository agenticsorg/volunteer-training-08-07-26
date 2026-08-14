"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxAuthorization = void 0;
const scope_set_1 = require("../value-objects/scope-set");
const mailbox_authorized_event_1 = require("../events/mailbox-authorized.event");
const mailbox_credential_revoked_event_1 = require("../events/mailbox-credential-revoked.event");
class MailboxAuthorization {
    constructor(id, tenantId, userId, mailboxId, platform, scopeSet, credentialHandle, // opaque reference to vault, never raw token
    consentGrantedAt, status = 'active') {
        this.id = id;
        this.tenantId = tenantId;
        this.userId = userId;
        this.mailboxId = mailboxId;
        this.platform = platform;
        this.scopeSet = scopeSet;
        this.credentialHandle = credentialHandle;
        this.consentGrantedAt = consentGrantedAt;
        this.status = status;
        this.domainEvents = [];
    }
    static create(tenantId, userId, mailboxId, platform, scopes, credentialHandle) {
        const scopeSet = platform === 'gmail'
            ? scope_set_1.ScopeSet.forGmail(scopes)
            : scope_set_1.ScopeSet.forOutlook(scopes);
        const auth = new MailboxAuthorization(`auth_${Date.now()}`, tenantId, userId, mailboxId, platform, scopeSet, credentialHandle, new Date());
        auth.domainEvents.push(new mailbox_authorized_event_1.MailboxAuthorizedEvent(tenantId, userId, mailboxId, platform, scopes));
        return auth;
    }
    getScopes() {
        return this.scopeSet.toArray();
    }
    getStatus() {
        return this.status;
    }
    revoke(reason) {
        if (this.status !== 'active') {
            throw new Error('Cannot revoke non-active authorization');
        }
        this.status = 'revoked';
        this.domainEvents.push(new mailbox_credential_revoked_event_1.MailboxCredentialRevokedEvent(this.tenantId, this.mailboxId, this.platform, reason));
    }
    getDomainEvents() {
        return this.domainEvents;
    }
    clearDomainEvents() {
        this.domainEvents = [];
    }
}
exports.MailboxAuthorization = MailboxAuthorization;
//# sourceMappingURL=mailbox-authorization.js.map