import { Expose } from 'class-transformer';

export class VipListEntryDto {
  @Expose()
  sender_address!: string;

  @Expose()
  display_name?: string;
}

export class CategoryRuleOverrideDto {
  @Expose()
  category!: string;

  @Expose()
  confidence_threshold!: number;

  @Expose()
  enabled!: boolean;
}

export class TenantConfigurationResponseDto {
  @Expose()
  tenant_id!: string;

  @Expose()
  plan_tier!: string;

  @Expose()
  vip_list!: VipListEntryDto[];

  @Expose()
  category_rule_overrides!: CategoryRuleOverrideDto[];

  @Expose()
  llm_budget_soft_limit?: number;

  @Expose()
  llm_budget_hard_limit?: number;

  @Expose()
  digest_frequency!: string;

  @Expose()
  created_at!: string;

  @Expose()
  updated_at!: string;
}

export class UpdateVipListDto {
  @Expose()
  entries!: VipListEntryDto[];
}

export class UpdateCategoryRulesDto {
  @Expose()
  overrides!: CategoryRuleOverrideDto[];
}

export class UpdateBudgetSettingsDto {
  @Expose()
  soft_limit?: number;

  @Expose()
  hard_limit?: number;
}

export class UpdateDigestFrequencyDto {
  @Expose()
  frequency!: string;
}
