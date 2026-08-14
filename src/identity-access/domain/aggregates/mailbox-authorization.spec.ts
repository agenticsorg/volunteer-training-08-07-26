import { MailboxAuthorization } from './mailbox-authorization';
import { MailboxAuthorizedEvent } from '../events/mailbox-authorized.event';
import { MailboxCredentialRevokedEvent } from '../events/mailbox-credential-revoked.event';

describe('MailboxAuthorization Aggregate', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-456';
  const mailboxId = 'mailbox-789';

  describe('Creation', () => {
    it('should create Gmail authorization with minimal scopes', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        'vault-handle-1',
      );

      expect(auth.tenantId).toBe(tenantId);
      expect(auth.userId).toBe(userId);
      expect(auth.mailboxId).toBe(mailboxId);
      expect(auth.platform).toBe('gmail');
      expect(auth.credentialHandle).toBe('vault-handle-1');
      expect(auth.getStatus()).toBe('active');
    });

    it('should publish MailboxAuthorizedEvent on creation', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        'vault-handle-1',
      );

      const events = auth.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(MailboxAuthorizedEvent);
    });

    it('should reject too-wide Gmail scopes', () => {
      expect(() =>
        MailboxAuthorization.create(
          tenantId,
          userId,
          mailboxId,
          'gmail',
          ['gmail.modify', 'gmail.labels', 'gmail.send'],
          'vault-handle-1',
        ),
      ).toThrow();
    });
  });

  describe('Revocation', () => {
    it('should revoke active authorization', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        'vault-handle-1',
      );

      auth.clearDomainEvents();
      auth.revoke('user_initiated');

      expect(auth.getStatus()).toBe('revoked');
    });

    it('should publish MailboxCredentialRevokedEvent on revocation', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        'vault-handle-1',
      );

      auth.clearDomainEvents();
      auth.revoke('user_initiated');

      const events = auth.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(MailboxCredentialRevokedEvent);
    });

    it('should not revoke non-active authorization', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        'vault-handle-1',
      );

      auth.revoke('user_initiated');

      expect(() => auth.revoke('admin_revoked')).toThrow(
        'Cannot revoke non-active authorization',
      );
    });
  });

  describe('Invariants', () => {
    it('should preserve credential handle as opaque reference', () => {
      const handle = 'vault-ref-abc123';
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'gmail',
        ['gmail.modify', 'gmail.labels'],
        handle,
      );

      expect(auth.credentialHandle).toBe(handle);
      // Ensure it's not storing raw tokens
      expect(auth.credentialHandle).not.toContain('refresh_token');
      expect(auth.credentialHandle).not.toContain('access_token');
    });

    it('should only allow Outlook with specific scopes', () => {
      const auth = MailboxAuthorization.create(
        tenantId,
        userId,
        mailboxId,
        'outlook',
        ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'],
        'vault-handle-2',
      );

      expect(auth.platform).toBe('outlook');
      expect(auth.getScopes()).toContain('Mail.ReadWrite');
    });
  });
});
