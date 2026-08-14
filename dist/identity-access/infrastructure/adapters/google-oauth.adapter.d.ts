import { OAuthProviderPort } from '../../domain/ports/oauth-provider.port';
import { SecretsVaultPort } from '../../domain/ports/secrets-vault.port';
export declare class GoogleOAuthAdapter implements OAuthProviderPort {
    private secretsVault;
    platform: 'gmail' | 'outlook';
    constructor(secretsVault: SecretsVaultPort);
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
//# sourceMappingURL=google-oauth.adapter.d.ts.map