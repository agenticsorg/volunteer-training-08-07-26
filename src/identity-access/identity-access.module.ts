import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailboxAuthorizationRepository } from './infrastructure/repositories/mailbox-authorization.repository';
import { MailboxAuthorizationService } from './application/mailbox-authorization.service';
import { GoogleOAuthAdapter } from './infrastructure/adapters/google-oauth.adapter';
import { MicrosoftOAuthAdapter } from './infrastructure/adapters/microsoft-oauth.adapter';
import { MockSecretsVaultAdapter } from './infrastructure/adapters/mock-secrets-vault.adapter';
import { OAuthController } from './presentation/oauth.controller';
import { MailboxController } from './presentation/mailbox.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [EventEmitterModule.forRoot(), DatabaseModule],
  controllers: [OAuthController, MailboxController],
  providers: [
    MailboxAuthorizationRepository,
    MailboxAuthorizationService,
    MockSecretsVaultAdapter,
    {
      provide: 'SECRETS_VAULT_PORT',
      useClass: MockSecretsVaultAdapter,
    },
    GoogleOAuthAdapter,
    MicrosoftOAuthAdapter,
    {
      provide: 'GOOGLE_OAUTH_ADAPTER',
      useClass: GoogleOAuthAdapter,
    },
    {
      provide: 'MICROSOFT_OAUTH_ADAPTER',
      useClass: MicrosoftOAuthAdapter,
    },
    {
      provide: 'SECRETS_VAULT',
      useClass: MockSecretsVaultAdapter,
    },
  ],
  exports: [MailboxAuthorizationService, MailboxAuthorizationRepository],
})
export class IdentityAccessModule {}
