import { Controller, Post, Body } from '@nestjs/common';
import { WebhookWorker } from '../infrastructure/queue/webhook.worker';

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhookWorker: WebhookWorker) {}
  
  @Post('gmail')
  async handleGmailWebhook(@Body() payload: any) {
    const { email } = payload;
    if (email) {
      await this.webhookWorker.handleWebhook('tenant-id', email, 'gmail');
    }
    return { status: 'received' };
  }
  
  @Post('outlook')
  async handleOutlookWebhook(@Body() payload: any) {
    const { mailboxId } = payload;
    if (mailboxId) {
      await this.webhookWorker.handleWebhook('tenant-id', mailboxId, 'outlook');
    }
    return { status: 'received' };
  }
}
