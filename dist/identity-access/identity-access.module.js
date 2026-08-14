"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityAccessModule = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const mailbox_authorization_repository_1 = require("./infrastructure/repositories/mailbox-authorization.repository");
const mailbox_authorization_service_1 = require("./application/mailbox-authorization.service");
const google_oauth_adapter_1 = require("./infrastructure/adapters/google-oauth.adapter");
const microsoft_oauth_adapter_1 = require("./infrastructure/adapters/microsoft-oauth.adapter");
const mock_secrets_vault_adapter_1 = require("./infrastructure/adapters/mock-secrets-vault.adapter");
const oauth_controller_1 = require("./presentation/oauth.controller");
const mailbox_controller_1 = require("./presentation/mailbox.controller");
const database_module_1 = require("../database/database.module");
let IdentityAccessModule = class IdentityAccessModule {
};
exports.IdentityAccessModule = IdentityAccessModule;
exports.IdentityAccessModule = IdentityAccessModule = __decorate([
    (0, common_1.Module)({
        imports: [event_emitter_1.EventEmitterModule.forRoot(), database_module_1.DatabaseModule],
        controllers: [oauth_controller_1.OAuthController, mailbox_controller_1.MailboxController],
        providers: [
            mailbox_authorization_repository_1.MailboxAuthorizationRepository,
            mailbox_authorization_service_1.MailboxAuthorizationService,
            mock_secrets_vault_adapter_1.MockSecretsVaultAdapter,
            google_oauth_adapter_1.GoogleOAuthAdapter,
            microsoft_oauth_adapter_1.MicrosoftOAuthAdapter,
            {
                provide: 'GOOGLE_OAUTH_ADAPTER',
                useClass: google_oauth_adapter_1.GoogleOAuthAdapter,
            },
            {
                provide: 'MICROSOFT_OAUTH_ADAPTER',
                useClass: microsoft_oauth_adapter_1.MicrosoftOAuthAdapter,
            },
            {
                provide: 'SECRETS_VAULT',
                useClass: mock_secrets_vault_adapter_1.MockSecretsVaultAdapter,
            },
        ],
        exports: [mailbox_authorization_service_1.MailboxAuthorizationService, mailbox_authorization_repository_1.MailboxAuthorizationRepository],
    })
], IdentityAccessModule);
//# sourceMappingURL=identity-access.module.js.map