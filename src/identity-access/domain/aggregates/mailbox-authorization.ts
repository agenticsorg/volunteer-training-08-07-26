import { ScopeSet } from '../value-objects/scope-set';
import { MailboxAuthorizedEvent } from '../events/mailbox-authorized.event';
import { MailboxCredentialRevokedEvent } from '../events/mailbox-credential-revoked.event';

export class MailboxAuthorization {
  private domainEvents: any[] = [];

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly userId: string,
    readonly mailboxId: string,
    readonly platform: 'gmail' | 'outlook',
    private scopeSet: ScopeSet,
    readonly credentialHandle: string, // opaque reference to vault, never raw token
    readonly consentGrantedAt: Date,
    private status: 'active' | 'revoked' | 'expired' = 'active',
  ) {}

  static create(
    tenantId: string,
    userId: string,
    mailboxId: string,
    platform: 'gmail' | 'outlook',
    scopes: string[],
    credentialHandle: string,
  ): MailboxAuthorization {
    const scopeSet =
      platform === 'gmail'
        ? ScopeSet.forGmail(scopes)
        : ScopeSet.forOutlook(scopes);

    const auth = new MailboxAuthorization(
      `auth_${Date.now()}`,
      tenantId,
      userId,
      mailboxId,
      platform,
      scopeSet,
      credentialHandle,
      new Date(),
    );

    auth.domainEvents.push(
      new MailboxAuthorizedEvent(tenantId, userId, mailboxId, platform, scopes),
    );

    return auth;
  }

  getScopes(): string[] {
    return this.scopeSet.toArray();
  }

  getStatus(): 'active' | 'revoked' | 'expired' {
    return this.status;
  }

  revoke(reason: 'user_initiated' | 'admin_revoked' | 'tenant_suspended'): void {
    if (this.status !== 'active') {
      throw new Error('Cannot revoke non-active authorization');
    }
    this.status = 'revoked';
    this.domainEvents.push(
      new MailboxCredentialRevokedEvent(
        this.tenantId,
        this.mailboxId,
        this.platform,
        reason,
      ),
    );
  }

  getDomainEvents(): any[] {
    return this.domainEvents;
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
