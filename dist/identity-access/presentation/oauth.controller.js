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
exports.OAuthController = void 0;
const common_1 = require("@nestjs/common");
const mailbox_authorization_service_1 = require("../application/mailbox-authorization.service");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
let OAuthController = class OAuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async authorize(platform, req) {
        const tenantId = req.tenantId;
        const state = `${tenantId}_${Date.now()}`;
        const scopes = platform === 'gmail'
            ? ['gmail.modify', 'gmail.labels']
            : ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'];
        // In real implementation, would call actual OAuth provider
        // For now, return mock URL
        return {
            authorizationUrl: `http://localhost:3000/oauth/callback?state=${state}&platform=${platform}`,
        };
    }
    async handleCallback(body, req) {
        const tenantId = req.tenantId;
        const userId = req.userId;
        const { code, state, platform } = body;
        // Parse state to extract original tenant/user
        const [stateTenantId] = state.split('_');
        if (stateTenantId !== tenantId) {
            throw new Error('State mismatch');
        }
        // In real implementation, exchange code for credential handle
        // For tests, this is mocked
        const scopes = platform === 'gmail'
            ? ['gmail.modify', 'gmail.labels']
            : ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'];
        const auth = await this.authService.grantConsent(tenantId, userId, `mailbox_${Date.now()}`, platform, scopes, `vault_ref_${Date.now()}`);
        return { mailboxId: auth.mailboxId, status: 'active' };
    }
};
exports.OAuthController = OAuthController;
__decorate([
    (0, common_1.Post)('authorize/:platform'),
    __param(0, (0, common_1.Param)('platform')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OAuthController.prototype, "authorize", null);
__decorate([
    (0, common_1.Post)('callback'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OAuthController.prototype, "handleCallback", null);
exports.OAuthController = OAuthController = __decorate([
    (0, common_1.Controller)('oauth'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [mailbox_authorization_service_1.MailboxAuthorizationService])
], OAuthController);
//# sourceMappingURL=oauth.controller.js.map