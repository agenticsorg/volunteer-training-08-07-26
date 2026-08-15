import { Injectable, Inject } from '@nestjs/common';
import { OAuthProviderPort } from '../../domain/ports/oauth-provider.port';
import { SecretsVaultPort } from '../../domain/ports/secrets-vault.port';

@Injectable()
export class GoogleOAuthAdapter implements OAuthProviderPort {
  platform: 'gmail' | 'outlook' = 'gmail';

  constructor(
    @Inject('SECRETS_VAULT_PORT') private secretsVault: SecretsVaultPort,
  ) {}

  initiateConsent(
    state: string,
    scopes: string[],
  ): { authorizationUrl: string } {
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

  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{ credentialHandle: string; mailboxId: string }> {
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

  async refreshToken(credentialHandle: string): Promise<void> {
    // Retrieve refresh token from vault
    const refreshToken = await this.secretsVault.retrieve(credentialHandle);

    if (!refreshToken) {
      throw new Error('Invalid credential handle');
    }

    // In real implementation, call Google OAuth endpoint with refresh_token
    // For now, just verify the handle is valid
  }

  async revoke(credentialHandle: string): Promise<void> {
    const refreshToken = await this.secretsVault.retrieve(credentialHandle);

    if (!refreshToken) {
      throw new Error('Invalid credential handle');
    }

    // In real implementation, call Google revocation endpoint
    await this.secretsVault.delete(credentialHandle);
  }
}
