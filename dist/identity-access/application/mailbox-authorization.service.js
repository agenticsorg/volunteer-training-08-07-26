"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxAuthorizationService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const mailbox_authorization_1 = require("../domain/aggregates/mailbox-authorization");
const mailbox_authorization_repository_1 = require("../infrastructure/repositories/mailbox-authorization.repository");
let MailboxAuthorizationService = class MailboxAuthorizationService {
    constructor(repository, googleOAuth, microsoftOAuth, eventEmitter) {
        this.repository = repository;
        this.googleOAuth = googleOAuth;
        this.microsoftOAuth = microsoftOAuth;
        this.eventEmitter = eventEmitter;
    }
    async grantConsent(tenantId, userId, mailboxId, platform, scopes, credentialHandle) {
        const auth = mailbox_authorization_1.MailboxAuthorization.create(tenantId, userId, mailboxId, platform, scopes, credentialHandle);
        await this.repository.save(tenantId, auth);
        const events = auth.getDomainEvents();
        for (const event of events) {
            this.eventEmitter.emit('mailbox.authorized', event);
        }
        return auth;
    }
    async refreshToken(tenantId, mailboxId) {
        const auth = await this.repository.findByTenantIdAndMailboxId(tenantId, mailboxId);
        if (!auth) {
            throw new Error('Authorization not found');
        }
        const oauthAdapter = auth.platform === 'gmail'
            ? this.googleOAuth
            : this.microsoftOAuth;
        await oauthAdapter.refreshToken(auth.credentialHandle);
    }
    async revoke(tenantId, mailboxId, reason) {
        const auth = await this.repository.findByTenantIdAndMailboxId(tenantId, mailboxId);
        if (!auth) {
            throw new Error('Authorization not found');
        }
        const oauthAdapter = auth.platform === 'gmail'
            ? this.googleOAuth
            : this.microsoftOAuth;
        auth.revoke(reason);
        await oauthAdapter.revoke(auth.credentialHandle);
        await this.repository.save(tenantId, auth);
        const events = auth.getDomainEvents();
        for (const event of events) {
            this.eventEmitter.emit('mailbox.credential.revoked', event);
        }
    }
    async revokeAllForTenant(tenantId) {
        const authorizations = await this.repository.findByTenantId(tenantId);
        for (const auth of authorizations) {
            const oauthAdapter = auth.platform === 'gmail'
                ? this.googleOAuth
                : this.microsoftOAuth;
            try {
                await oauthAdapter.revoke(auth.credentialHandle);
            }
            catch (err) {
                // Log but continue revoking others
                console.error(`Failed to revoke ${auth.mailboxId}:`, err);
            }
        }
        await this.repository.revokeAllForTenant(tenantId);
    }
};
exports.MailboxAuthorizationService = MailboxAuthorizationService;
exports.MailboxAuthorizationService = MailboxAuthorizationService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('GOOGLE_OAUTH_ADAPTER')),
    __param(2, (0, common_1.Inject)('MICROSOFT_OAUTH_ADAPTER')),
    __metadata("design:paramtypes", [mailbox_authorization_repository_1.MailboxAuthorizationRepository, Object, Object, event_emitter_1.EventEmitter2])
], MailboxAuthorizationService);
//# sourceMappingURL=mailbox-authorization.service.js.map