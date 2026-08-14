import { MailboxAuthorizationService } from '../application/mailbox-authorization.service';
export declare class OAuthController {
    private authService;
    constructor(authService: MailboxAuthorizationService);
    authorize(platform: string, req: any): Promise<{
        authorizationUrl: string;
    }>;
    handleCallback(body: {
        code: string;
        state: string;
        platform: string;
    }, req: any): Promise<{
        mailboxId: string;
        status: string;
    }>;
}
//# sourceMappingURL=oauth.controller.d.ts.map