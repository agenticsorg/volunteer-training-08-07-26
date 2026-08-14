import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MailboxAuthorizationService } from '../application/mailbox-authorization.service';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('oauth')
@UseGuards(TenantGuard)
export class OAuthController {
  constructor(private authService: MailboxAuthorizationService) {}

  @Post('authorize/:platform')
  async authorize(
    @Param('platform') platform: string,
    @Req() req: any,
  ): Promise<{ authorizationUrl: string }> {
    const tenantId = req.tenantId;
    const state = `${tenantId}_${Date.now()}`;

    const scopes = platform === 'gmail'
      ? ['gmail.modify', 'gmail.labels']
      : ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'];

    // In real implementation, would call actual OAuth provider
    // For now, return mock URL
    return {
      authorizationUrl: `http://localhost:3000/oauth/callback?state=${state}&platform=${platform}`,
    };
  }

  @Post('callback')
  async handleCallback(
    @Body() body: { code: string; state: string; platform: string },
    @Req() req: any,
  ): Promise<{ mailboxId: string; status: string }> {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { code, state, platform } = body;

    // Parse state to extract original tenant/user
    const [stateTenantId] = state.split('_');

    if (stateTenantId !== tenantId) {
      throw new Error('State mismatch');
    }

    // In real implementation, exchange code for credential handle
    // For tests, this is mocked
    const scopes = platform === 'gmail'
      ? ['gmail.modify', 'gmail.labels']
      : ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'];

    const auth = await this.authService.grantConsent(
      tenantId,
      userId,
      `mailbox_${Date.now()}`,
      platform as 'gmail' | 'outlook',
      scopes,
      `vault_ref_${Date.now()}`,
    );

    return { mailboxId: auth.mailboxId, status: 'active' };
  }
}
