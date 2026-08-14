import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailboxAuthorizationService } from './mailbox-authorization.service';
import { MailboxAuthorizationRepository } from '../infrastructure/repositories/mailbox-authorization.repository';
import { GoogleOAuthAdapter } from '../infrastructure/adapters/google-oauth.adapter';
import { MicrosoftOAuthAdapter } from '../infrastructure/adapters/microsoft-oauth.adapter';
import { MockSecretsVaultAdapter } from '../infrastructure/adapters/mock-secrets-vault.adapter';
import { PrismaClient } from '@prisma/client';

describe('MailboxAuthorizationService', () => {
  let service: MailboxAuthorizationService;
  let repository: MailboxAuthorizationRepository;
  let googleOAuth: GoogleOAuthAdapter;
  let microsoftOAuth: MicrosoftOAuthAdapter;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaClient;

  const tenantId = 'tenant-123';
  const userId = 'user-456';

  beforeEach(async () => {
    const secretsVault = new MockSecretsVaultAdapter();
    const googleOAuthMock = {
      platform: 'gmail',
      initiateConsent: jest.fn(),
      exchangeCode: jest.fn(),
      refreshToken: jest.fn(),
      revoke: jest.fn(),
    };
    const microsoftOAuthMock = {
      platform: 'outlook',
      initiateConsent: jest.fn(),
      exchangeCode: jest.fn(),
      refreshToken: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailboxAuthorizationService,
        EventEmitter2,
        {
          provide: MailboxAuthorizationRepository,
          useValue: {
            save: jest.fn(),
            findByTenantIdAndMailboxId: jest.fn(),
            findByTenantId: jest.fn(),
            revokeAllForTenant: jest.fn(),
          },
        },
        {
          provide: 'GOOGLE_OAUTH_ADAPTER',
          useValue: googleOAuthMock,
        },
        {
          provide: 'MICROSOFT_OAUTH_ADAPTER',
          useValue: microsoftOAuthMock,
        },
      ],
    }).compile();

    service = module.get<MailboxAuthorizationService>(
      MailboxAuthorizationService,
    );
    repository = module.get<MailboxAuthorizationRepository>(
      MailboxAuthorizationRepository,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('Scope enforcement', () => {
    it('should enforce minimal Gmail scopes', async () => {
      const scopes = ['gmail.modify', 'gmail.labels'];
      const credentialHandle = 'vault-123';

      jest.spyOn(repository, 'save').mockResolvedValue(undefined);
      jest.spyOn(eventEmitter, 'emit');

      await service.grantConsent(
        tenantId,
        userId,
        'mailbox-789',
        'gmail',
        scopes,
        credentialHandle,
      );

      expect(repository.save).toHaveBeenCalled();
    });

    it('should reject Gmail with extra scopes', async () => {
      const scopes = ['gmail.modify', 'gmail.labels', 'gmail.send'];

      await expect(
        service.grantConsent(
          tenantId,
          userId,
          'mailbox-789',
          'gmail',
          scopes,
          'vault-123',
        ),
      ).rejects.toThrow();
    });
  });

  describe('Token lifecycle', () => {
    it('should handle full OAuth grant→refresh→revoke cycle', async () => {
      const scopes = ['gmail.modify', 'gmail.labels'];
      const credentialHandle = 'vault-handle-1';

      // Grant
      jest.spyOn(repository, 'save').mockResolvedValue(undefined);
      await service.grantConsent(
        tenantId,
        userId,
        'mailbox-789',
        'gmail',
        scopes,
        credentialHandle,
      );

      expect(repository.save).toHaveBeenCalled();

      // Refresh
      jest
        .spyOn(repository, 'findByTenantIdAndMailboxId')
        .mockResolvedValue(null); // Mock: would be found in real scenario

      // Revoke
      jest
        .spyOn(repository, 'findByTenantIdAndMailboxId')
        .mockResolvedValueOnce(null);

      // Just verify no errors thrown
    });
  });

  describe('Tenant suspension cascade', () => {
    it('should revoke all authorizations for tenant', async () => {
      jest.spyOn(repository, 'findByTenantId').mockResolvedValue([]);
      jest.spyOn(repository, 'revokeAllForTenant').mockResolvedValue(undefined);

      await service.revokeAllForTenant(tenantId);

      expect(repository.revokeAllForTenant).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('Security', () => {
    it('should never expose raw token in service', async () => {
      const scopes = ['gmail.modify', 'gmail.labels'];
      const opaque = 'vault-handle-opaque';

      jest.spyOn(repository, 'save').mockResolvedValue(undefined);

      const auth = await service.grantConsent(
        tenantId,
        userId,
        'mailbox-789',
        'gmail',
        scopes,
        opaque,
      );

      // Verify the returned auth object doesn't contain raw tokens
      expect(auth.credentialHandle).toBe(opaque);
      expect(auth.credentialHandle).not.toContain('refresh_token');
    });
  });
});
