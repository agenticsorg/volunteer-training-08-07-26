export interface OAuthProviderPort {
    platform: 'gmail' | 'outlook';
    initiateConsent(state: string, scopes: string[]): {
        authorizationUrl: string;
    };
    exchangeCode(code: string, state: string): Promise<{
        credentialHandle: string;
        mailboxId: string;
    }>;
    refreshToken(credentialHandle: string): Promise<void>;
    revoke(credentialHandle: string): Promise<void>;
}
//# sourceMappingURL=oauth-provider.port.d.ts.map