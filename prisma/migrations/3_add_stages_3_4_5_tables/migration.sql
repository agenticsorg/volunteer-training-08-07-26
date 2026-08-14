-- ============================================================================
-- Stage 3: Mailbox Ingestion
-- ============================================================================

-- CreateTable mailbox_connections
CREATE TABLE "mailbox_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
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

-- CreateTable ingested_messages
CREATE TABLE "ingested_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
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

-- CreateTable message_body_refs
CREATE TABLE "message_body_refs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "body_hash" TEXT NOT NULL,
    "body_storage_ref" TEXT NOT NULL,
    "ttl_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_body_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable sync_event_logs
CREATE TABLE "sync_event_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mailbox_connection_id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable outbox_events
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex mailbox_connections
CREATE UNIQUE INDEX "mailbox_connections_tenant_id_mailbox_id_platform_key" ON "mailbox_connections"("tenant_id", "mailbox_id", "platform");
CREATE INDEX "mailbox_connections_tenant_id_idx" ON "mailbox_connections"("tenant_id");
CREATE INDEX "mailbox_connections_status_idx" ON "mailbox_connections"("status");

-- CreateIndex ingested_messages
CREATE UNIQUE INDEX "ingested_messages_tenant_id_message_id_key" ON "ingested_messages"("tenant_id", "message_id");
CREATE UNIQUE INDEX "ingested_messages_tenant_id_platform_message_id_platform_mailbox_idx" ON "ingested_messages"("tenant_id", "platform_message_id", "platform", "mailbox_id");
CREATE INDEX "ingested_messages_tenant_id_idx" ON "ingested_messages"("tenant_id");
CREATE INDEX "ingested_messages_mailbox_id_idx" ON "ingested_messages"("mailbox_id");
CREATE INDEX "ingested_messages_mailbox_connection_id_idx" ON "ingested_messages"("mailbox_connection_id");

-- CreateIndex message_body_refs
CREATE INDEX "message_body_refs_tenant_id_idx" ON "message_body_refs"("tenant_id");
CREATE INDEX "message_body_refs_ttl_expires_at_idx" ON "message_body_refs"("ttl_expires_at");

-- CreateIndex sync_event_logs
CREATE INDEX "sync_event_logs_tenant_id_idx" ON "sync_event_logs"("tenant_id");
CREATE INDEX "sync_event_logs_mailbox_connection_id_idx" ON "sync_event_logs"("mailbox_connection_id");
CREATE INDEX "sync_event_logs_eventType_idx" ON "sync_event_logs"("eventType");

-- CreateIndex outbox_events
CREATE INDEX "outbox_events_tenant_id_idx" ON "outbox_events"("tenant_id");
CREATE INDEX "outbox_events_published_idx" ON "outbox_events"("published");

-- ============================================================================
-- Stage 4: Classification
-- ============================================================================

-- CreateTable message_label
CREATE TABLE "message_labels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "source_tier" TEXT NOT NULL,
    "classifier_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable pipeline_version
CREATE TABLE "pipeline_version" (
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

    CONSTRAINT "pipeline_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable shadow_eval_run
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

-- CreateIndex message_label
CREATE UNIQUE INDEX "message_label_message_id_category_key" ON "message_labels"("message_id", "category");
CREATE INDEX "message_label_tenant_id_idx" ON "message_labels"("tenant_id");
CREATE INDEX "message_label_message_id_idx" ON "message_labels"("message_id");

-- CreateIndex pipeline_version
CREATE UNIQUE INDEX "pipeline_version_version_key" ON "pipeline_version"("version");
CREATE INDEX "pipeline_version_is_active_idx" ON "pipeline_version"("is_active");
CREATE INDEX "pipeline_version_deployed_at_idx" ON "pipeline_version"("deployed_at");

-- CreateIndex shadow_eval_run
CREATE INDEX "shadow_eval_run_tenant_id_idx" ON "shadow_eval_runs"("tenant_id");
CREATE INDEX "shadow_eval_run_approved_at_idx" ON "shadow_eval_runs"("approved_at");

-- ============================================================================
-- Stage 5: Contact Graph
-- ============================================================================

-- CreateTable sender_profile
CREATE TABLE "sender_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "sender_address" TEXT NOT NULL,
    "classification" JSONB NOT NULL,
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "bidirectional_interactions" INTEGER NOT NULL DEFAULT 0,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "vip_auto_promoted" BOOLEAN NOT NULL DEFAULT false,
    "last_interaction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sender_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex sender_profile
CREATE UNIQUE INDEX "sender_profile_tenant_id_mailbox_id_sender_address_key" ON "sender_profiles"("tenant_id", "mailbox_id", "sender_address");
CREATE INDEX "sender_profile_tenant_id_mailbox_id_idx" ON "sender_profiles"("tenant_id", "mailbox_id");

-- ============================================================================
-- Enable RLS on all tenant-scoped tables
-- ============================================================================

ALTER TABLE "mailbox_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingested_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_body_refs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_event_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shadow_eval_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sender_profiles" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies for tenant isolation
-- ============================================================================

-- mailbox_connections tenant isolation
CREATE POLICY "mailbox_connections_tenant_isolation" ON "mailbox_connections" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- ingested_messages tenant isolation
CREATE POLICY "ingested_messages_tenant_isolation" ON "ingested_messages" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- message_body_refs tenant isolation
CREATE POLICY "message_body_refs_tenant_isolation" ON "message_body_refs" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- sync_event_logs tenant isolation
CREATE POLICY "sync_event_logs_tenant_isolation" ON "sync_event_logs" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- outbox_events tenant isolation
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- message_label tenant isolation
CREATE POLICY "message_label_tenant_isolation" ON "message_labels" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- shadow_eval_run tenant isolation
CREATE POLICY "shadow_eval_run_tenant_isolation" ON "shadow_eval_runs" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- sender_profile tenant isolation
CREATE POLICY "sender_profile_tenant_isolation" ON "sender_profiles" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- ============================================================================
-- Stage 6: Threat Detection
-- ============================================================================

-- CreateTable threat_assessment
CREATE TABLE "threat_assessments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "auth_signal" JSONB,
    "lookalike_score" JSONB,
    "intent_classification" JSONB,
    "quarantine_decision" TEXT NOT NULL DEFAULT 'none',
    "quarantine_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable brand_watchlist
CREATE TABLE "brand_watchlist" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL UNIQUE,
    "brand_name" TEXT NOT NULL,
    "impersonation_risk_level" TEXT NOT NULL DEFAULT 'medium',
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex threat_assessment
CREATE UNIQUE INDEX "threat_assessment_tenant_id_message_id_key" ON "threat_assessments"("tenant_id", "message_id");
CREATE INDEX "threat_assessment_tenant_id_quarantine_locked_idx" ON "threat_assessments"("tenant_id", "quarantine_locked");

-- CreateIndex brand_watchlist
CREATE INDEX "brand_watchlist_domain_idx" ON "brand_watchlist"("domain");

-- ============================================================================
-- Stage 7: Prioritization
-- ============================================================================

-- CreateTable message_priorities
CREATE TABLE "message_priorities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "components" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable scoring_weights
CREATE TABLE "scoring_weights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL UNIQUE,
    "vip_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "frequency_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "urgency_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "calendar_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "needs_reply_aging_weight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex message_priorities
CREATE UNIQUE INDEX "message_priorities_tenant_id_message_id_key" ON "message_priorities"("tenant_id", "message_id");
CREATE INDEX "message_priorities_tenant_id_priority_score_idx" ON "message_priorities"("tenant_id", "priority_score");

-- CreateIndex scoring_weights
CREATE INDEX "scoring_weights_tenant_id_idx" ON "scoring_weights"("tenant_id");

-- ============================================================================
-- Stage 8: Mailbox Write-back
-- ============================================================================

-- CreateTable message_write_back_state
CREATE TABLE "message_write_back_state" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "facets" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_write_back_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex message_write_back_state
CREATE UNIQUE INDEX "message_write_back_state_tenant_id_mailbox_id_message_id_key" ON "message_write_back_state"("tenant_id", "mailbox_id", "message_id");
CREATE INDEX "message_write_back_state_tenant_id_mailbox_id_idx" ON "message_write_back_state"("tenant_id", "mailbox_id");

-- ============================================================================
-- Stage 9: Feedback & Learning
-- ============================================================================

-- CreateTable correction_record
CREATE TABLE "correction_record" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "verdict" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'explicit_user_action',
    "state" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable sender_reputation_cache
CREATE TABLE "sender_reputation_cache" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sender_domain" TEXT NOT NULL,
    "category_confidence" JSONB NOT NULL DEFAULT '{}',
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sender_reputation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex correction_record
CREATE INDEX "correction_record_tenant_id_state_idx" ON "correction_record"("tenant_id", "state");

-- CreateIndex sender_reputation_cache
CREATE UNIQUE INDEX "sender_reputation_cache_tenant_id_sender_domain_key" ON "sender_reputation_cache"("tenant_id", "sender_domain");
CREATE INDEX "sender_reputation_cache_tenant_id_idx" ON "sender_reputation_cache"("tenant_id");

-- ============================================================================
-- Stage 10: Notification & Alerting
-- ============================================================================

-- CreateTable notification_subscription
CREATE TABLE "notification_subscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "authorized_channels" TEXT[] NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable alert_dispatch
CREATE TABLE "alert_dispatch" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL UNIQUE,
    "category" TEXT NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cool_down_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex notification_subscription
CREATE UNIQUE INDEX "notification_subscription_tenant_id_user_id_key" ON "notification_subscription"("tenant_id", "user_id");
CREATE INDEX "notification_subscription_tenant_id_idx" ON "notification_subscription"("tenant_id");

-- CreateIndex alert_dispatch
CREATE INDEX "alert_dispatch_tenant_id_user_id_category_idx" ON "alert_dispatch"("tenant_id", "user_id", "category");

-- ============================================================================
-- Enable RLS on Stage 6-10 tenant-scoped tables
-- ============================================================================

ALTER TABLE "threat_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_priorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scoring_weights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_write_back_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "correction_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sender_reputation_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_dispatch" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies for Stage 6-10 tenant isolation
-- ============================================================================

-- threat_assessment tenant isolation
CREATE POLICY "threat_assessment_tenant_isolation" ON "threat_assessments" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- message_priorities tenant isolation
CREATE POLICY "message_priorities_tenant_isolation" ON "message_priorities" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- scoring_weights tenant isolation
CREATE POLICY "scoring_weights_tenant_isolation" ON "scoring_weights" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- message_write_back_state tenant isolation
CREATE POLICY "message_write_back_state_tenant_isolation" ON "message_write_back_state" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- correction_record tenant isolation
CREATE POLICY "correction_record_tenant_isolation" ON "correction_record" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- sender_reputation_cache tenant isolation
CREATE POLICY "sender_reputation_cache_tenant_isolation" ON "sender_reputation_cache" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- notification_subscription tenant isolation
CREATE POLICY "notification_subscription_tenant_isolation" ON "notification_subscription" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);

-- alert_dispatch tenant isolation
CREATE POLICY "alert_dispatch_tenant_isolation" ON "alert_dispatch" USING (
  "tenant_id" = current_setting('row_security_context.tenant_id')::TEXT
);
