import { MailboxAuthorizationService } from '../application/mailbox-authorization.service';
import { MailboxAuthorizationRepository } from '../infrastructure/repositories/mailbox-authorization.repository';
export declare class MailboxController {
    private authService;
    private repository;
    constructor(authService: MailboxAuthorizationService, repository: MailboxAuthorizationRepository);
    listMailboxes(req: any): Promise<any[]>;
    revokeMailbox(mailboxId: string, req: any): Promise<{
        status: string;
    }>;
}
//# sourceMappingURL=mailbox.controller.d.ts.map