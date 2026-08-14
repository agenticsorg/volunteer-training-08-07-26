import {
  Controller,
  Get,
  Put,
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
import {
  TenantConfigurationResponseDto,
  UpdateVipListDto,
  UpdateCategoryRulesDto,
  UpdateBudgetSettingsDto,
  UpdateDigestFrequencyDto,
} from '../dtos/tenant-config.dto';

@Controller('v1/tenant-configuration/:tenantId')
@UseGuards(ApiKeyGuard, ApiTenantScopeGuard)
export class TenantConfigController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getTenantConfiguration(@Param('tenantId') tenantId: string): Promise<TenantConfigurationResponseDto> {
    const [tenant, subscription, weights, senderProfiles] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
      }),
      this.prisma.subscription.findUnique({
        where: { tenantId },
        include: { currentPlan: true },
      }),
      this.prisma.scoringWeights.findUnique({
        where: { tenant_id: tenantId },
      }),
      this.prisma.senderProfile.findMany({
        where: {
          tenant_id: tenantId,
          is_vip: true,
        },
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const vipList = senderProfiles.map((sp) => ({
      sender_address: sp.sender_address,
      display_name: undefined,
    }));

    return {
      tenant_id: tenantId,
      plan_tier: subscription?.currentPlan?.llmTierCeiling || 'tier-1-only',
      vip_list: vipList,
      category_rule_overrides: [],
      llm_budget_soft_limit: 1000,
      llm_budget_hard_limit: 2000,
      digest_frequency: 'daily',
      created_at: tenant.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: tenant.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  @Put('vip-list')
  async updateVipList(
    @Param('tenantId') tenantId: string,
    @Body() request: UpdateVipListDto,
  ): Promise<{ success: boolean }> {
    // Update VIP status for sender profiles
    for (const entry of request.entries) {
      await this.prisma.senderProfile.updateMany({
        where: {
          tenant_id: tenantId,
          sender_address: entry.sender_address,
        },
        data: {
          is_vip: true,
          vip_auto_promoted: false, // Explicitly set
        },
      });
    }

    return { success: true };
  }

  @Put('category-rules')
  async updateCategoryRules(
    @Param('tenantId') tenantId: string,
    @Body() request: UpdateCategoryRulesDto,
  ): Promise<{ success: boolean }> {
    // TODO: Store category rule overrides in the database
    // For now, just acknowledge the update
    return { success: true };
  }

  @Put('budget-settings')
  async updateBudgetSettings(
    @Param('tenantId') tenantId: string,
    @Body() request: UpdateBudgetSettingsDto,
  ): Promise<{ success: boolean }> {
    // TODO: Update budget settings
    // For now, just acknowledge the update
    return { success: true };
  }

  @Put('digest-frequency')
  async updateDigestFrequency(
    @Param('tenantId') tenantId: string,
    @Body() request: UpdateDigestFrequencyDto,
  ): Promise<{ success: boolean }> {
    const validFrequencies = ['daily', 'weekly', 'off'];
    if (!validFrequencies.includes(request.frequency)) {
      throw new BadRequestException('Invalid digest frequency');
    }

    // TODO: Update notification subscription preferences
    return { success: true };
  }
}
