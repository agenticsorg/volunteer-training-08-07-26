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
exports.MailboxController = void 0;
const common_1 = require("@nestjs/common");
const mailbox_authorization_service_1 = require("../application/mailbox-authorization.service");
const mailbox_authorization_repository_1 = require("../infrastructure/repositories/mailbox-authorization.repository");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
let MailboxController = class MailboxController {
    constructor(authService, repository) {
        this.authService = authService;
        this.repository = repository;
    }
    async listMailboxes(req) {
        const tenantId = req.tenantId;
        const authorizations = await this.repository.findByTenantId(tenantId);
        return authorizations.map((auth) => ({
            mailboxId: auth.mailboxId,
            platform: auth.platform,
            status: auth.getStatus(),
            scopes: auth.getScopes(),
            consentGrantedAt: auth.consentGrantedAt,
        }));
    }
    async revokeMailbox(mailboxId, req) {
        const tenantId = req.tenantId;
        await this.authService.revoke(tenantId, mailboxId, 'user_initiated');
        return { status: 'revoked' };
    }
};
exports.MailboxController = MailboxController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MailboxController.prototype, "listMailboxes", null);
__decorate([
    (0, common_1.Post)(':mailboxId/revoke'),
    __param(0, (0, common_1.Param)('mailboxId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MailboxController.prototype, "revokeMailbox", null);
exports.MailboxController = MailboxController = __decorate([
    (0, common_1.Controller)('mailboxes'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [mailbox_authorization_service_1.MailboxAuthorizationService,
        mailbox_authorization_repository_1.MailboxAuthorizationRepository])
], MailboxController);
//# sourceMappingURL=mailbox.controller.js.map