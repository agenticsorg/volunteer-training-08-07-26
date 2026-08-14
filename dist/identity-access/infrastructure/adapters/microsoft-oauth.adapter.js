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
exports.MicrosoftOAuthAdapter = void 0;
const common_1 = require("@nestjs/common");
let MicrosoftOAuthAdapter = class MicrosoftOAuthAdapter {
    constructor(secretsVault) {
        this.secretsVault = secretsVault;
        this.platform = 'outlook';
    }
    initiateConsent(state, scopes) {
        const clientId = process.env.MS_OAUTH_CLIENT_ID || '';
        const redirectUri = process.env.MS_OAUTH_REDIRECT_URI || '';
        if (!clientId || !redirectUri) {
            throw new Error('Microsoft OAuth configuration missing');
        }
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
            state: state,
            response_mode: 'query',
        });
        return {
            authorizationUrl: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`,
        };
    }
    async exchangeCode(code, state) {
        const clientId = process.env.MS_OAUTH_CLIENT_ID || '';
        const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET || '';
        const redirectUri = process.env.MS_OAUTH_REDIRECT_URI || '';
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Microsoft OAuth configuration missing');
        }
        // Mock response for tests; in real implementation, call Microsoft token endpoint
        const mockRefreshToken = `refresh_token_${Date.now()}`;
        const credentialHandle = await this.secretsVault.store(mockRefreshToken);
        const mockMailboxId = `outlook_${Date.now()}`;
        return { credentialHandle, mailboxId: mockMailboxId };
    }
    async refreshToken(credentialHandle) {
        const refreshToken = await this.secretsVault.retrieve(credentialHandle);
        if (!refreshToken) {
            throw new Error('Invalid credential handle');
        }
        // In real implementation, call Microsoft token endpoint with refresh_token
    }
    async revoke(credentialHandle) {
        const refreshToken = await this.secretsVault.retrieve(credentialHandle);
        if (!refreshToken) {
            throw new Error('Invalid credential handle');
        }
        // In real implementation, call Microsoft revocation endpoint
        await this.secretsVault.delete(credentialHandle);
    }
};
exports.MicrosoftOAuthAdapter = MicrosoftOAuthAdapter;
exports.MicrosoftOAuthAdapter = MicrosoftOAuthAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], MicrosoftOAuthAdapter);
//# sourceMappingURL=microsoft-oauth.adapter.js.map