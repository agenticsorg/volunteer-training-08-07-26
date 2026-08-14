export interface OAuthProviderPort {
  platform: 'gmail' | 'outlook';

  // Initiate OAuth flow, return authorization URL
  initiateConsent(
    state: string,
    scopes: string[],
  ): { authorizationUrl: string };

  // Exchange authorization code for credential handle (opaque reference)
  exchangeCode(
    code: string,
    state: string,
  ): Promise<{
    credentialHandle: string; // opaque reference, never raw token
    mailboxId: string;
  }>;

  // Refresh token using credential handle
  refreshToken(credentialHandle: string): Promise<void>;

  // Revoke token using credential handle
  revoke(credentialHandle: string): Promise<void>;
}
