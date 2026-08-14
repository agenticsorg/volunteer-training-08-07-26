import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MailboxAuthorizationService } from '../application/mailbox-authorization.service';
import { MailboxAuthorizationRepository } from '../infrastructure/repositories/mailbox-authorization.repository';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('mailboxes')
@UseGuards(TenantGuard)
export class MailboxController {
  constructor(
    private authService: MailboxAuthorizationService,
    private repository: MailboxAuthorizationRepository,
  ) {}

  @Get()
  async listMailboxes(@Req() req: any): Promise<any[]> {
    const tenantId = req.tenantId;
    const authorizations = await this.repository.findByTenantId(tenantId);

    return authorizations.map((auth) => ({
      mailboxId: auth.mailboxId,
      platform: auth.platform,
      status: auth.getStatus(),
      scopes: auth.getScopes(),
      consentGrantedAt: auth.consentGrantedAt,
    }));
  }

  @Post(':mailboxId/revoke')
  async revokeMailbox(
    @Param('mailboxId') mailboxId: string,
    @Req() req: any,
  ): Promise<{ status: string }> {
    const tenantId = req.tenantId;

    await this.authService.revoke(tenantId, mailboxId, 'user_initiated');

    return { status: 'revoked' };
  }
}
