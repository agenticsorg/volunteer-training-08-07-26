import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  MessageResourceDto,
  MessageQueryDto,
  PaginatedMessageResponseDto,
} from '../dtos/message.dto';
import { TenantGuard } from '../guards/tenant.guard';

interface TenantRequest {
  tenantId: string;
  userId: string;
  mailboxId: string;
}

@Controller('v1/messages')
@UseGuards(TenantGuard)
export class MessagesController {
  @Get()
  async listMessages(
    @Req() req: any,
    @Query() query: MessageQueryDto,
  ): Promise<PaginatedMessageResponseDto> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Stub: would query actual data with tenant isolation
    return {
      data: [],
      total: 0,
      skip: query.skip || 0,
      take: query.take || 50,
    };
  }

  @Get(':id')
  async getMessage(
    @Req() req: any,
    @Param('id') messageId: string,
  ): Promise<MessageResourceDto> {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Stub: would load message with four facets and verify tenant isolation
    throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
  }

  @Post(':id/corrections')
  async submitCorrection(
    @Req() req: any,
    @Param('id') messageId: string,
    @Body() correction: any,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Stub: would create CorrectionRecord in Stage 9's high-trust path
    return {
      id: 'correction-id',
      messageId,
      source: 'explicit_user_action',
      state: 'confirmed',
      createdAt: new Date(),
    };
  }
}
