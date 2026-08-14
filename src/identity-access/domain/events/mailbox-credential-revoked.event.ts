export type RevocationReason =
  | 'user_initiated'
  | 'admin_revoked'
  | 'platform_invalidated'
  | 'tenant_suspended'
  | 'expired';

export class MailboxCredentialRevokedEvent {
  constructor(
    readonly tenantId: string,
    readonly mailboxId: string,
    readonly platform: 'gmail' | 'outlook',
    readonly reason: RevocationReason,
    readonly timestamp: Date = new Date(),
  ) {}
}
