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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxAuthorizationRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const mailbox_authorization_1 = require("../../domain/aggregates/mailbox-authorization");
const scope_set_1 = require("../../domain/value-objects/scope-set");
let MailboxAuthorizationRepository = class MailboxAuthorizationRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(tenantId, auth) {
        const events = auth.getDomainEvents();
        await this.prisma.mailboxAuthorization.upsert({
            where: {
                tenantId_userId_mailboxId_platform: {
                    tenantId,
                    userId: auth.userId,
                    mailboxId: auth.mailboxId,
                    platform: auth.platform,
                },
            },
            update: {
                status: auth.getStatus(),
                lastTokenRefreshedAt: new Date(),
            },
            create: {
                tenantId,
                userId: auth.userId,
                mailboxId: auth.mailboxId,
                platform: auth.platform,
                scopeSet: auth.getScopes(),
                consentGrantedAt: auth.consentGrantedAt,
                credentialHandle: auth.credentialHandle,
                status: 'active',
            },
        });
        // Store consent grant
        if (events.length > 0) {
            const consentGrant = events.find((e) => e.constructor.name === 'MailboxAuthorizedEvent');
            if (consentGrant) {
                const dbAuth = await this.prisma.mailboxAuthorization.findUnique({
                    where: {
                        tenantId_userId_mailboxId_platform: {
                            tenantId,
                            userId: auth.userId,
                            mailboxId: auth.mailboxId,
                            platform: auth.platform,
                        },
                    },
                });
                if (dbAuth) {
                    await this.prisma.consentGrant.create({
                        data: {
                            mailboxAuthorizationId: dbAuth.id,
                            scopeSet: consentGrant.scopes,
                            grantedAt: new Date(),
                        },
                    });
                }
            }
        }
        auth.clearDomainEvents();
    }
    async findByTenantIdAndMailboxId(tenantId, mailboxId) {
        const record = await this.prisma.mailboxAuthorization.findFirst({
            where: { tenantId, mailboxId },
        });
        if (!record)
            return null;
        const scopeSet = record.platform === 'gmail'
            ? scope_set_1.ScopeSet.forGmail(record.scopeSet)
            : scope_set_1.ScopeSet.forOutlook(record.scopeSet);
        return new mailbox_authorization_1.MailboxAuthorization(record.id, record.tenantId, record.userId, record.mailboxId, record.platform, scopeSet, record.credentialHandle, record.consentGrantedAt, record.status);
    }
    async findByTenantId(tenantId) {
        const records = await this.prisma.mailboxAuthorization.findMany({
            where: { tenantId, status: 'active' },
        });
        return records.map((record) => {
            const scopeSet = record.platform === 'gmail'
                ? scope_set_1.ScopeSet.forGmail(record.scopeSet)
                : scope_set_1.ScopeSet.forOutlook(record.scopeSet);
            return new mailbox_authorization_1.MailboxAuthorization(record.id, record.tenantId, record.userId, record.mailboxId, record.platform, scopeSet, record.credentialHandle, record.consentGrantedAt, record.status);
        });
    }
    async revokeAllForTenant(tenantId) {
        await this.prisma.mailboxAuthorization.updateMany({
            where: { tenantId, status: 'active' },
            data: { status: 'revoked', updatedAt: new Date() },
        });
    }
};
exports.MailboxAuthorizationRepository = MailboxAuthorizationRepository;
exports.MailboxAuthorizationRepository = MailboxAuthorizationRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_1.PrismaClient])
], MailboxAuthorizationRepository);
//# sourceMappingURL=mailbox-authorization.repository.js.map