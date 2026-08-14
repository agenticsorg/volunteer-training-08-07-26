import { Expose } from 'class-transformer';

export class UsageMeterDto {
  @Expose()
  meter_type!: string;

  @Expose()
  usage_count!: number;

  @Expose()
  overage_threshold!: number;

  @Expose()
  overage_detected!: boolean;

  @Expose()
  billing_period_start!: string;

  @Expose()
  billing_period_end!: string;

  @Expose()
  last_incremented_at?: string;
}

export class SubscriptionDto {
  @Expose()
  id!: string;

  @Expose()
  tenant_id!: string;

  @Expose()
  status!: string;

  @Expose()
  current_plan!: PlanDto;

  @Expose()
  plan_version!: number;

  @Expose()
  plan_changed_at?: string;

  @Expose()
  created_at!: string;

  @Expose()
  updated_at!: string;
}

export class PlanDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  mailbox_limit!: number;

  @Expose()
  llm_tier_ceiling!: string;

  @Expose()
  features!: Record<string, any>;
}

export class BillingInfoResponseDto {
  @Expose()
  subscription!: SubscriptionDto;

  @Expose()
  usage_meters!: UsageMeterDto[];

  @Expose()
  current_period_cost?: number;

  @Expose()
  estimated_overage_cost?: number;
}
