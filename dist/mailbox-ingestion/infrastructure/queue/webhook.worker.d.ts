import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailboxConnectionRepository, IngestedMessageRepository } from '../repositories';
export declare class WebhookWorker {
    private mailboxRepo;
    private messageRepo;
    private eventEmitter;
    private logger;
    constructor(mailboxRepo: MailboxConnectionRepository, messageRepo: IngestedMessageRepository, eventEmitter: EventEmitter2);
    handleWebhook(tenantId: string, mailboxId: string, platform: string): Promise<void>;
}
//# sourceMappingURL=webhook.worker.d.ts.map