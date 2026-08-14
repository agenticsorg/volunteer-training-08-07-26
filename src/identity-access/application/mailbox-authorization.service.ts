import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailboxAuthorization } from '../domain/aggregates/mailbox-authorization';
import { MailboxAuthorizationRepository } from '../infrastructure/repositories/mailbox-authorization.repository';
import { OAuthProviderPort } from '../domain/ports/oauth-provider.port';

@Injectable()
export class MailboxAuthorizationService {
  constructor(
    private repository: MailboxAuthorizationRepository,
    @Inject('GOOGLE_OAUTH_ADAPTER') private googleOAuth: OAuthProviderPort,
    @Inject('MICROSOFT_OAUTH_ADAPTER') private microsoftOAuth: OAuthProviderPort,
    private eventEmitter: EventEmitter2,
  ) {}

  async grantConsent(
    tenantId: string,
    userId: string,
    mailboxId: string,
    platform: 'gmail' | 'outlook',
    scopes: string[],
    credentialHandle: string,
  ): Promise<MailboxAuthorization> {
    const auth = MailboxAuthorization.create(
      tenantId,
      userId,
      mailboxId,
      platform,
      scopes,
      credentialHandle,
    );

    await this.repository.save(tenantId, auth);

    const events = auth.getDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit('mailbox.authorized', event);
    }

    return auth;
  }

  async refreshToken(
    tenantId: string,
    mailboxId: string,
  ): Promise<void> {
    const auth = await this.repository.findByTenantIdAndMailboxId(
      tenantId,
      mailboxId,
    );

    if (!auth) {
      throw new Error('Authorization not found');
    }

    const oauthAdapter = auth.platform === 'gmail'
      ? this.googleOAuth
      : this.microsoftOAuth;

    await oauthAdapter.refreshToken(auth.credentialHandle);
  }

  async revoke(
    tenantId: string,
    mailboxId: string,
    reason: 'user_initiated' | 'admin_revoked' | 'tenant_suspended',
  ): Promise<void> {
    const auth = await this.repository.findByTenantIdAndMailboxId(
      tenantId,
      mailboxId,
    );

    if (!auth) {
      throw new Error('Authorization not found');
    }

    const oauthAdapter = auth.platform === 'gmail'
      ? this.googleOAuth
      : this.microsoftOAuth;

    auth.revoke(reason);
    await oauthAdapter.revoke(auth.credentialHandle);
    await this.repository.save(tenantId, auth);

    const events = auth.getDomainEvents();
    for (const event of events) {
      this.eventEmitter.emit('mailbox.credential.revoked', event);
    }
  }

  async revokeAllForTenant(tenantId: string): Promise<void> {
    const authorizations = await this.repository.findByTenantId(tenantId);

    for (const auth of authorizations) {
      const oauthAdapter = auth.platform === 'gmail'
        ? this.googleOAuth
        : this.microsoftOAuth;

      try {
        await oauthAdapter.revoke(auth.credentialHandle);
      } catch (err) {
        // Log but continue revoking others
        console.error(`Failed to revoke ${auth.mailboxId}:`, err);
      }
    }

    await this.repository.revokeAllForTenant(tenantId);
  }
}
