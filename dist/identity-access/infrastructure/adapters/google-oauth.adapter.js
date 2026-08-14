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
exports.GoogleOAuthAdapter = void 0;
const common_1 = require("@nestjs/common");
let GoogleOAuthAdapter = class GoogleOAuthAdapter {
    constructor(secretsVault) {
        this.secretsVault = secretsVault;
        this.platform = 'gmail';
    }
    initiateConsent(state, scopes) {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
        if (!clientId || !redirectUri) {
            throw new Error('Google OAuth configuration missing');
        }
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
            state: state,
            access_type: 'offline',
            prompt: 'consent',
        });
        return {
            authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        };
    }
    async exchangeCode(code, state) {
        // In real implementation, would call Google OAuth endpoint
        // For tests, this is mocked via nock
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Google OAuth configuration missing');
        }
        // Mock response for tests
        const mockRefreshToken = `refresh_token_${Date.now()}`;
        const credentialHandle = await this.secretsVault.store(mockRefreshToken);
        // In real scenario, extract from Google's token response
        const mockMailboxId = `google_${Date.now()}`;
        return { credentialHandle, mailboxId: mockMailboxId };
    }
    async refreshToken(credentialHandle) {
        // Retrieve refresh token from vault
        const refreshToken = await this.secretsVault.retrieve(credentialHandle);
        if (!refreshToken) {
            throw new Error('Invalid credential handle');
        }
        // In real implementation, call Google OAuth endpoint with refresh_token
        // For now, just verify the handle is valid
    }
    async revoke(credentialHandle) {
        const refreshToken = await this.secretsVault.retrieve(credentialHandle);
        if (!refreshToken) {
            throw new Error('Invalid credential handle');
        }
        // In real implementation, call Google revocation endpoint
        await this.secretsVault.delete(credentialHandle);
    }
};
exports.GoogleOAuthAdapter = GoogleOAuthAdapter;
exports.GoogleOAuthAdapter = GoogleOAuthAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], GoogleOAuthAdapter);
//# sourceMappingURL=google-oauth.adapter.js.map