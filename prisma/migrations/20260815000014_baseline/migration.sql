-- CreateEnum
CREATE TYPE "Category" AS ENUM ('PERSONAL', 'WORK', 'MARKETING', 'FINANCE', 'HEALTH', 'SHOPPING', 'TRAVEL', 'SOCIAL', 'NEEDS_REPLY');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "authProvider" TEXT,
    "authSubject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_authorizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scopeSet" JSONB NOT NULL,
    "consentGrantedAt" TIMESTAMP(3) NOT NULL,
    "lastTokenRefreshedAt" TIMESTAMP(3),
    "credentialHandle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mailboxAuthorizationId" UUID NOT NULL,
    "scopeSet" JSONB NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "consentProofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretVaultRef" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "minScopes" JSONB NOT NULL,
    "adminScopes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "mailbox_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "watch_subscription_id" TEXT,
    "watch_expires_at" TIMESTAMP(3),
    "sync_cursor_value" TEXT,
    "credential_handle_id" TEXT NOT NULL,
    "last_webhook_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "sync_failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingested_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "mailbox_connection_id" TEXT,
    "platform_message_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "normalized_envelope" JSONB NOT NULL,
    "body_ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingested_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_body_refs" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "body_storage_ref" TEXT NOT NULL,
    "ttl_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_body_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_event_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mailbox_connection_id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_labels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "source_tier" TEXT NOT NULL,
    "classifier_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "rule_prompt_hash" TEXT,
    "llm_model_tier" TEXT NOT NULL,
    "cheap_llm_model" TEXT NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
    "frontier_llm_model" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployed_at" TIMESTAMP(3),
    "canary_cohorts" JSONB NOT NULL DEFAULT '[]',
    "active_cohort_fraction" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PipelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenDataset" (
    "id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "expected_labels" JSONB NOT NULL,
    "message_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "GoldenDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shadow_eval_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pipeline_version_from" TEXT NOT NULL,
    "pipeline_version_to" TEXT NOT NULL,
    "eval_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "per_category_metrics" JSONB NOT NULL,
    "regression_detected" BOOLEAN NOT NULL DEFAULT false,
    "regression_details" JSONB,
    "approved_at" TIMESTAMP(3),
    "approval_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shadow_eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "sender_address" TEXT NOT NULL,
    "classification" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "bidirectional_count" INTEGER NOT NULL DEFAULT 0,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "vip_auto_promoted" BOOLEAN NOT NULL DEFAULT false,
    "last_interaction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_assessments" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "auth_signal" JSONB,
    "lookalike_score" JSONB,
    "intent_classification" JSONB,
    "quarantine_decision" TEXT NOT NULL DEFAULT 'none',
    "quarantine_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_watchlist" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "impersonation_risk_level" TEXT NOT NULL DEFAULT 'medium',
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_priorities" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_weights" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vip_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "frequency_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "urgency_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "calendar_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "needs_reply_aging_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_write_back_states" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" UUID NOT NULL,
    "facets" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_write_back_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_records" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "verdict" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'explicit_user_action',
    "state" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_reputation_caches" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sender_domain" TEXT NOT NULL,
    "category_confidence" JSONB NOT NULL DEFAULT '{}',
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sender_reputation_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferences" JSONB NOT NULL,
    "authorized_channels" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_dispatches" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alert_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cool_down_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "mailbox_authorizations_tenantId_idx" ON "mailbox_authorizations"("tenantId");

-- CreateIndex
CREATE INDEX "mailbox_authorizations_userId_idx" ON "mailbox_authorizations"("userId");

-- CreateIndex
CREATE INDEX "mailbox_authorizations_mailboxId_idx" ON "mailbox_authorizations"("mailboxId");

-- CreateIndex
CREATE INDEX "mailbox_authorizations_status_idx" ON "mailbox_authorizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_authorizations_tenantId_userId_mailboxId_platform_key" ON "mailbox_authorizations"("tenantId", "userId", "mailboxId", "platform");

-- CreateIndex
CREATE INDEX "consent_grants_mailboxAuthorizationId_idx" ON "consent_grants"("mailboxAuthorizationId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_providers_platform_key" ON "oauth_providers"("platform");

-- CreateIndex
CREATE INDEX "message_queue_tenantId_idx" ON "message_queue"("tenantId");

-- CreateIndex
CREATE INDEX "message_queue_status_idx" ON "message_queue"("status");

-- CreateIndex
CREATE INDEX "metrics_tenantId_idx" ON "metrics"("tenantId");

-- CreateIndex
CREATE INDEX "metrics_timestamp_idx" ON "metrics"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "usage_meters_tenantId_meterType_idx" ON "usage_meters"("tenantId", "meterType");

-- CreateIndex
CREATE INDEX "usage_meters_billingPeriodStart_idx" ON "usage_meters"("billingPeriodStart");

-- CreateIndex
CREATE UNIQUE INDEX "usage_meters_tenantId_meterType_billingPeriodStart_billingP_key" ON "usage_meters"("tenantId", "meterType", "billingPeriodStart", "billingPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_billing_events_stripeEventId_key" ON "subscription_billing_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "subscription_billing_events_tenantId_idx" ON "subscription_billing_events"("tenantId");

-- CreateIndex
CREATE INDEX "subscription_billing_events_stripeEventId_idx" ON "subscription_billing_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "subscription_billing_events_processed_idx" ON "subscription_billing_events"("processed");

-- CreateIndex
CREATE INDEX "mailbox_connections_tenant_id_idx" ON "mailbox_connections"("tenant_id");

-- CreateIndex
CREATE INDEX "mailbox_connections_status_idx" ON "mailbox_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_connections_tenant_id_mailbox_id_platform_key" ON "mailbox_connections"("tenant_id", "mailbox_id", "platform");

-- CreateIndex
CREATE INDEX "ingested_messages_tenant_id_idx" ON "ingested_messages"("tenant_id");

-- CreateIndex
CREATE INDEX "ingested_messages_mailbox_id_idx" ON "ingested_messages"("mailbox_id");

-- CreateIndex
CREATE INDEX "ingested_messages_mailbox_connection_id_idx" ON "ingested_messages"("mailbox_connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingested_messages_tenant_id_message_id_key" ON "ingested_messages"("tenant_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingested_messages_tenant_id_platform_message_id_platform_ma_key" ON "ingested_messages"("tenant_id", "platform_message_id", "platform", "mailbox_id");

-- CreateIndex
CREATE INDEX "message_body_refs_tenant_id_idx" ON "message_body_refs"("tenant_id");

-- CreateIndex
CREATE INDEX "message_body_refs_ttl_expires_at_idx" ON "message_body_refs"("ttl_expires_at");

-- CreateIndex
CREATE INDEX "sync_event_logs_tenant_id_idx" ON "sync_event_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "sync_event_logs_mailbox_connection_id_idx" ON "sync_event_logs"("mailbox_connection_id");

-- CreateIndex
CREATE INDEX "sync_event_logs_eventType_idx" ON "sync_event_logs"("eventType");

-- CreateIndex
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_idx" ON "outbox_events"("published");

-- CreateIndex
CREATE INDEX "message_labels_tenant_id_idx" ON "message_labels"("tenant_id");

-- CreateIndex
CREATE INDEX "message_labels_message_id_idx" ON "message_labels"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_labels_message_id_category_key" ON "message_labels"("message_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineVersion_version_key" ON "PipelineVersion"("version");

-- CreateIndex
CREATE INDEX "PipelineVersion_is_active_idx" ON "PipelineVersion"("is_active");

-- CreateIndex
CREATE INDEX "PipelineVersion_deployed_at_idx" ON "PipelineVersion"("deployed_at");

-- CreateIndex
CREATE INDEX "GoldenDataset_archived_at_idx" ON "GoldenDataset"("archived_at");

-- CreateIndex
CREATE INDEX "shadow_eval_runs_tenant_id_idx" ON "shadow_eval_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "shadow_eval_runs_approved_at_idx" ON "shadow_eval_runs"("approved_at");

-- CreateIndex
CREATE INDEX "sender_profiles_tenant_id_mailbox_id_idx" ON "sender_profiles"("tenant_id", "mailbox_id");

-- CreateIndex
CREATE INDEX "sender_profiles_is_vip_idx" ON "sender_profiles"("is_vip");

-- CreateIndex
CREATE UNIQUE INDEX "sender_profiles_tenant_id_mailbox_id_sender_address_key" ON "sender_profiles"("tenant_id", "mailbox_id", "sender_address");

-- CreateIndex
CREATE INDEX "threat_assessments_tenant_id_quarantine_locked_idx" ON "threat_assessments"("tenant_id", "quarantine_locked");

-- CreateIndex
CREATE UNIQUE INDEX "threat_assessments_tenant_id_message_id_key" ON "threat_assessments"("tenant_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_watchlist_domain_key" ON "brand_watchlist"("domain");

-- CreateIndex
CREATE INDEX "brand_watchlist_domain_idx" ON "brand_watchlist"("domain");

-- CreateIndex
CREATE INDEX "message_priorities_tenant_id_priority_score_idx" ON "message_priorities"("tenant_id", "priority_score");

-- CreateIndex
CREATE UNIQUE INDEX "message_priorities_tenant_id_message_id_key" ON "message_priorities"("tenant_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_weights_tenant_id_key" ON "scoring_weights"("tenant_id");

-- CreateIndex
CREATE INDEX "scoring_weights_tenant_id_idx" ON "scoring_weights"("tenant_id");

-- CreateIndex
CREATE INDEX "message_write_back_states_tenant_id_mailbox_id_idx" ON "message_write_back_states"("tenant_id", "mailbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_write_back_states_tenant_id_mailbox_id_message_id_key" ON "message_write_back_states"("tenant_id", "mailbox_id", "message_id");

-- CreateIndex
CREATE INDEX "correction_records_tenant_id_state_idx" ON "correction_records"("tenant_id", "state");

-- CreateIndex
CREATE INDEX "sender_reputation_caches_tenant_id_idx" ON "sender_reputation_caches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sender_reputation_caches_tenant_id_sender_domain_key" ON "sender_reputation_caches"("tenant_id", "sender_domain");

-- CreateIndex
CREATE INDEX "notification_subscriptions_tenant_id_idx" ON "notification_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscriptions_tenant_id_user_id_key" ON "notification_subscriptions"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_dispatches_alert_id_key" ON "alert_dispatches"("alert_id");

-- CreateIndex
CREATE INDEX "alert_dispatches_tenant_id_user_id_category_idx" ON "alert_dispatches"("tenant_id", "user_id", "category");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_authorizations" ADD CONSTRAINT "mailbox_authorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_authorizations" ADD CONSTRAINT "mailbox_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_mailboxAuthorizationId_fkey" FOREIGN KEY ("mailboxAuthorizationId") REFERENCES "mailbox_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_currentPlanId_fkey" FOREIGN KEY ("currentPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_connections" ADD CONSTRAINT "mailbox_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_messages" ADD CONSTRAINT "ingested_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_messages" ADD CONSTRAINT "ingested_messages_mailbox_connection_id_fkey" FOREIGN KEY ("mailbox_connection_id") REFERENCES "mailbox_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingested_messages" ADD CONSTRAINT "ingested_messages_body_ref_id_fkey" FOREIGN KEY ("body_ref_id") REFERENCES "message_body_refs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_body_refs" ADD CONSTRAINT "message_body_refs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_event_logs" ADD CONSTRAINT "sync_event_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_event_logs" ADD CONSTRAINT "sync_event_logs_mailbox_connection_id_fkey" FOREIGN KEY ("mailbox_connection_id") REFERENCES "mailbox_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_labels" ADD CONSTRAINT "message_labels_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ingested_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sender_profiles" ADD CONSTRAINT "sender_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Enable RLS on tenant-scoped tables
-- ============================================================================

ALTER TABLE "mailbox_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingested_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_body_refs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_event_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sender_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_priorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scoring_weights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_write_back_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "correction_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sender_reputation_caches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_dispatches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shadow_eval_runs" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies for tenant isolation
-- ============================================================================

CREATE POLICY "mailbox_connections_tenant_isolation" ON "mailbox_connections" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "ingested_messages_tenant_isolation" ON "ingested_messages" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "message_body_refs_tenant_isolation" ON "message_body_refs" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "sync_event_logs_tenant_isolation" ON "sync_event_logs" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "message_labels_tenant_isolation" ON "message_labels" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "sender_profiles_tenant_isolation" ON "sender_profiles" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "threat_assessments_tenant_isolation" ON "threat_assessments" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "message_priorities_tenant_isolation" ON "message_priorities" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "scoring_weights_tenant_isolation" ON "scoring_weights" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "message_write_back_states_tenant_isolation" ON "message_write_back_states" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "correction_records_tenant_isolation" ON "correction_records" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "sender_reputation_caches_tenant_isolation" ON "sender_reputation_caches" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "notification_subscriptions_tenant_isolation" ON "notification_subscriptions" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "alert_dispatches_tenant_isolation" ON "alert_dispatches" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "shadow_eval_runs_tenant_isolation" ON "shadow_eval_runs" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);
