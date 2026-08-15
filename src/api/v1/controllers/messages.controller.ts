import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiTenantScopeGuard } from '../guards/api-tenant-scope.guard';
import { MessagesListResponseDto, MessageResponseDto, CorrectionSubmitDto } from '../dtos/message.dto';

@Controller('v1/messages')
@UseGuards(ApiKeyGuard, ApiTenantScopeGuard)
export class MessagesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async listMessages(
    @Tenant() tenantId: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Query('category') category?: string,
    @Query('priority_min') priorityMin?: string,
    @Query('has_phishing_flag') hasPhishingFlag?: string,
  ): Promise<MessagesListResponseDto> {
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    const where: any = { tenantId };

    // Build where clause for filters
    if (category) {
      // Filter by message label category
      // Will implement through JOIN with message_labels table
    }

    const [messages, total] = await Promise.all([
      this.prisma.ingestedMessage.findMany({
        where,
        take: parsedLimit,
        skip: parsedOffset,
        include: {
          messageLabels: true,
        },
      }),
      this.prisma.ingestedMessage.count({ where }),
    ]);

    // Get priority and threat data for messages
    const messageIds = messages.map((m) => m.messageId);
    const [priorityMap, threatMap] = await Promise.all([
      this.getMessagePriorities(tenantId, messageIds),
      this.getMessageThreats(tenantId, messageIds),
    ]);

    const response: MessagesListResponseDto = {
      messages: messages.map((msg) => this.toMessageDto(msg, priorityMap, threatMap)),
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    };

    return response;

  }

  @Get(':messageId')
  async getMessageDetails(
    @Tenant() tenantId: string,
    @Param('messageId') messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.prisma.ingestedMessage.findUnique({
      where: { tenantId_messageId: { tenantId, messageId } },
      include: {
        messageLabels: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const [priority, threat] = await Promise.all([
      this.getMessagePriority(tenantId, message.messageId),
      this.getMessageThreat(tenantId, message.messageId),
    ]);

    const priorityMap = new Map();
    if (priority) priorityMap.set(message.messageId, priority);
    const threatMap = new Map();
    if (threat) threatMap.set(message.messageId, threat);

    return this.toMessageDto(message, priorityMap, threatMap);
  }

  @Post(':messageId/corrections')
  async submitCorrection(
    @Tenant() tenantId: string,
    @Param('messageId') messageId: string,
    @Body() correction: CorrectionSubmitDto,
  ): Promise<{ correction_id: string }> {
    // Verify message exists and belongs to tenant
    const message = await this.prisma.ingestedMessage.findUnique({
      where: { tenantId_messageId: { tenantId, messageId } },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Store correction record (explicit user action = high trust)
    const correctionRecord = await this.prisma.correctionRecord.create({
      data: {
        tenant_id: tenantId,
        message_id: messageId,
        verdict: {
          context: correction.context,
          original_verdict: correction.original_verdict,
          corrected_verdict: correction.corrected_verdict,
        },
        source: 'explicit_user_action',
        state: 'confirmed',
      },
    });

    return { correction_id: correctionRecord.id };
  }

  private async getMessagePriorities(tenantId: string, messageIds: string[]): Promise<Map<string, any>> {
    const priorities = await this.prisma.messagePriority.findMany({
      where: {
        tenant_id: tenantId,
        message_id: { in: messageIds },
      },
    });

    const map = new Map();
    priorities.forEach((p) => map.set(p.message_id, p));
    return map;
  }

  private async getMessagePriority(tenantId: string, messageId: string): Promise<any> {
    return this.prisma.messagePriority.findUnique({
      where: {
        tenant_id_message_id: {
          tenant_id: tenantId,
          message_id: messageId,
        },
      },
    });
  }

  private async getMessageThreats(tenantId: string, messageIds: string[]): Promise<Map<string, any>> {
    const threats = await this.prisma.threatAssessment.findMany({
      where: {
        tenant_id: tenantId,
        message_id: { in: messageIds },
      },
    });

    const map = new Map();
    threats.forEach((t) => map.set(t.message_id, t));
    return map;
  }

  private async getMessageThreat(tenantId: string, messageId: string): Promise<any> {
    return this.prisma.threatAssessment.findUnique({
      where: {
        tenant_id_message_id: {
          tenant_id: tenantId,
          message_id: messageId,
        },
      },
    });
  }

  private toMessageDto(
    message: any,
    priorityMap: Map<string, any>,
    threatMap: Map<string, any>,
  ): MessageResponseDto {
    const priority = priorityMap.get(message.messageId);
    const threat = threatMap.get(message.messageId);
    const envelope = message.normalizedEnvelope || {};

    const components = priority?.components || [];
    const priorityComponents = Array.isArray(components)
      ? components.map((c: any) => ({
          name: c.name,
          value: c.value || 0,
          weight: c.weight || 0,
          contribution: c.contribution || 0,
        }))
      : [];

    return {
      id: message.id,
      message_id: message.messageId,
      mailbox_id: message.mailboxId,
      platform: message.platform,
      from: envelope.from || '',
      subject: envelope.subject || '',
      thread_id: envelope.threadRef,
      received_at: envelope.received_at || new Date().toISOString(),
      labels: (message.messageLabels || []).map((l: any) => ({
        category: l.category,
        confidence_score: parseFloat(l.confidence_score as any),
        source_tier: l.source_tier,
      })),
      priority_score: priority?.priority_score || 0,
      priority_components: priorityComponents,
      phishing_status: threat?.quarantine_decision || 'none',
      quarantine_decision: threat?.quarantine_decision || 'none',
      needs_reply: message.messageLabels?.some((l: any) => l.category === 'NEEDS_REPLY'),
      created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}
