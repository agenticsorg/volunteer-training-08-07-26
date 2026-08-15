import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiTenantScopeGuard } from '../guards/api-tenant-scope.guard';
import {
  MailboxConnectionsListResponseDto,
  MailboxConnectionResponseDto,
  ConnectMailboxRequestDto,
  DisconnectMailboxRequestDto,
} from '../dtos/mailbox.dto';

@Controller('v1/mailbox-connections')
@UseGuards(ApiKeyGuard, ApiTenantScopeGuard)
export class MailboxController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async listMailboxConnections(@Tenant() tenantId: string): Promise<MailboxConnectionsListResponseDto> {
    const connections = await this.prisma.mailboxConnection.findMany({
      where: { tenantId },
    });

    return {
      connections: connections.map((conn) => this.toMailboxDto(conn)),
      total: connections.length,
    };
  }

  @Get(':mailboxId')
  async getMailboxConnection(
    @Tenant() tenantId: string,
    @Param('mailboxId') mailboxId: string,
  ): Promise<MailboxConnectionResponseDto> {
    const connection = await this.prisma.mailboxConnection.findUnique({
      where: {
        tenantId_mailboxId_platform: {
          tenantId,
          mailboxId,
          platform: 'gmail',
        },
      },
    });

    if (!connection) {
      throw new NotFoundException('Mailbox connection not found');
    }

    return this.toMailboxDto(connection);
  }

  @Post()
  async connectMailbox(
    @Tenant() tenantId: string,
    @Body() request: ConnectMailboxRequestDto,
  ): Promise<{ connection_id: string; status: string }> {
    const connection = await this.prisma.mailboxConnection.create({
      data: {
        tenantId,
        mailboxId: `${request.platform}:placeholder`,
        platform: request.platform,
        status: 'active',
        credentialHandleId: 'placeholder-handle', // TODO: Replace with actual OAuth token reference
      },
    });

    return {
      connection_id: connection.id,
      status: connection.status,
    };
  }

  @Delete(':mailboxId')
  async disconnectMailbox(
    @Tenant() tenantId: string,
    @Param('mailboxId') mailboxId: string,
  ): Promise<{ success: boolean }> {
    const connection = await this.prisma.mailboxConnection.findFirst({
      where: {
        tenantId,
        mailboxId,
      },
    });

    if (!connection) {
      throw new NotFoundException('Mailbox connection not found');
    }

    // Mark as revoked instead of deleting
    await this.prisma.mailboxConnection.update({
      where: { id: connection.id },
      data: { status: 'revoked' },
    });

    return { success: true };
  }

  private toMailboxDto(connection: any): MailboxConnectionResponseDto {
    return {
      id: connection.id,
      mailbox_id: connection.mailbox_id,
      platform: connection.platform,
      status: connection.status,
      watch_expires_at: connection.watch_expires_at?.toISOString(),
      last_webhook_at: connection.last_webhook_at?.toISOString(),
      last_sync_at: connection.last_sync_at?.toISOString(),
      sync_failure_count: connection.sync_failure_count,
      created_at: connection.created_at?.toISOString(),
      updated_at: connection.updated_at?.toISOString(),
    };
  }
}
