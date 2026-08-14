import { Injectable } from '@nestjs/common';
import { OAuthProviderPort } from '../../domain/ports/oauth-provider.port';
import { SecretsVaultPort } from '../../domain/ports/secrets-vault.port';

@Injectable()
export class MicrosoftOAuthAdapter implements OAuthProviderPort {
  platform: 'gmail' | 'outlook' = 'outlook';

  constructor(private secretsVault: SecretsVaultPort) {}

  initiateConsent(
    state: string,
    scopes: string[],
  ): { authorizationUrl: string } {
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

  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{ credentialHandle: string; mailboxId: string }> {
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

  async refreshToken(credentialHandle: string): Promise<void> {
    const refreshToken = await this.secretsVault.retrieve(credentialHandle);

    if (!refreshToken) {
      throw new Error('Invalid credential handle');
    }

    // In real implementation, call Microsoft token endpoint with refresh_token
  }

  async revoke(credentialHandle: string): Promise<void> {
    const refreshToken = await this.secretsVault.retrieve(credentialHandle);

    if (!refreshToken) {
      throw new Error('Invalid credential handle');
    }

    // In real implementation, call Microsoft revocation endpoint
    await this.secretsVault.delete(credentialHandle);
  }
}
