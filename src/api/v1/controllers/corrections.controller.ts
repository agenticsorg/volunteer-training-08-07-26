import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../guards/tenant.guard';

@Controller('v1/corrections')
@UseGuards(TenantGuard)
export class CorrectionsController {
  @Post()
  async submitCorrection(
    @Req() req: any,
    @Body()
    correction: {
      messageId: string;
      originalVerdict: any;
      correctedVerdict: any;
      context: 'classification' | 'priority' | 'threat' | 'contact';
    },
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Creates high-trust correction (explicit_user_action)
    // for Stage 9's CorrectionRecord aggregate
    return {
      id: 'correction-' + Date.now(),
      tenantId,
      messageId: correction.messageId,
      source: 'explicit_user_action',
      state: 'confirmed',
      originalVerdict: correction.originalVerdict,
      correctedVerdict: correction.correctedVerdict,
      createdAt: new Date(),
    };
  }

  @Get()
  async listCorrections(@Req() req: any) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Stub: would list corrections for this tenant with pagination
    return {
      data: [],
      total: 0,
      skip: 0,
      take: 50,
    };
  }

  @Get(':id')
  async getCorrection(@Req() req: any, @Param('id') correctionId: string) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new HttpException(
        'Tenant context not found',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Stub: would load correction with tenant isolation
    throw new HttpException('Correction not found', HttpStatus.NOT_FOUND);
  }
}
