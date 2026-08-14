import { WebhookWorker } from '../infrastructure/queue/webhook.worker';
export declare class WebhooksController {
    private webhookWorker;
    constructor(webhookWorker: WebhookWorker);
    handleGmailWebhook(payload: any): Promise<{
        status: string;
    }>;
    handleOutlookWebhook(payload: any): Promise<{
        status: string;
    }>;
}
//# sourceMappingURL=webhooks.controller.d.ts.map