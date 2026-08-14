-- CreateTable plans
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "mailboxLimit" INTEGER NOT NULL,
    "llmTierCeiling" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable subscriptions
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "currentPlanId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "planChangedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable usage_meters
CREATE TABLE "usage_meters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "meterType" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "usageCount" BIGINT NOT NULL DEFAULT 0,
    "overageThreshold" BIGINT NOT NULL,
    "overageDetected" BOOLEAN NOT NULL DEFAULT false,
    "lastIncrementedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable subscription_billing_events
CREATE TABLE "subscription_billing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex plans
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- CreateIndex subscriptions
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions"("tenantId");
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex usage_meters
CREATE UNIQUE INDEX "usage_meters_tenantId_meterType_billingPeriodStart_billingPeriodEnd_key" ON "usage_meters"("tenantId", "meterType", "billingPeriodStart", "billingPeriodEnd");
CREATE INDEX "usage_meters_tenantId_meterType_idx" ON "usage_meters"("tenantId", "meterType");
CREATE INDEX "usage_meters_billingPeriodStart_idx" ON "usage_meters"("billingPeriodStart");

-- CreateIndex subscription_billing_events
CREATE INDEX "subscription_billing_events_tenantId_idx" ON "subscription_billing_events"("tenantId");
CREATE UNIQUE INDEX "subscription_billing_events_stripeEventId_key" ON "subscription_billing_events"("stripeEventId");
CREATE INDEX "subscription_billing_events_processed_idx" ON "subscription_billing_events"("processed");

-- AddForeignKey subscriptions -> plans
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_currentPlanId_fkey" FOREIGN KEY ("currentPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS on tenant-scoped tables
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_meters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_billing_events" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for subscriptions table
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);

-- Create RLS policies for usage_meters table
CREATE POLICY "usage_meters_tenant_isolation" ON "usage_meters" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);

-- Create RLS policies for subscription_billing_events table
CREATE POLICY "subscription_billing_events_tenant_isolation" ON "subscription_billing_events" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);
