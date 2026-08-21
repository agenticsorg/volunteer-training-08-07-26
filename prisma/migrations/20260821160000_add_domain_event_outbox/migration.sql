-- ADR 0023: the "outbox_events" table added in the baseline migration was never
-- referenced anywhere in src/ (dead schema). Replace it with the real
-- transactional outbox ("domain_event_outbox", with retry/backoff bookkeeping)
-- and add consume-side idempotency tracking. There is no production data in
-- outbox_events to preserve (it was never written to), so this drops and
-- recreates rather than renaming in place.

-- DropTable
DROP TABLE "outbox_events";

-- CreateTable
CREATE TABLE "domain_event_outbox" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_consumer_checkpoint" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outbox_event_id" TEXT NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_consumer_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_event_outbox_tenant_id_idx" ON "domain_event_outbox"("tenant_id");

-- CreateIndex
CREATE INDEX "domain_event_outbox_published_idx" ON "domain_event_outbox"("published");

-- CreateIndex
CREATE UNIQUE INDEX "event_consumer_checkpoint_outbox_event_id_consumer_name_key" ON "event_consumer_checkpoint"("outbox_event_id", "consumer_name");

-- CreateIndex
CREATE INDEX "event_consumer_checkpoint_tenant_id_idx" ON "event_consumer_checkpoint"("tenant_id");

-- AddForeignKey
ALTER TABLE "domain_event_outbox" ADD CONSTRAINT "domain_event_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_consumer_checkpoint" ADD CONSTRAINT "event_consumer_checkpoint_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Enable RLS on new tenant-scoped tables
-- ============================================================================

ALTER TABLE "domain_event_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_consumer_checkpoint" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies for tenant isolation
-- ============================================================================

CREATE POLICY "domain_event_outbox_tenant_isolation" ON "domain_event_outbox" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

CREATE POLICY "event_consumer_checkpoint_tenant_isolation" ON "event_consumer_checkpoint" USING (
  "tenant_id"::text = current_setting('row_security_context.tenant_id')
);

-- ============================================================================
-- Restricted, non-owner application role for RLS-enforced connections
-- ============================================================================
-- IMPORTANT — see GitHub issue for the full finding: every RLS policy in this
-- schema (baseline migration onward) is currently a no-op in practice,
-- because the application connects as the table OWNER, and Postgres exempts
-- a table's owner from its own RLS policies unless the table has FORCE ROW
-- LEVEL SECURITY set (which nothing in this schema does). Verified directly:
-- setting row_security_context.tenant_id to one tenant and then querying
-- "tenants" as the owner role still returns every tenant's rows.
--
-- FORCE ROW LEVEL SECURITY was deliberately NOT added broadly in this
-- migration — it would also block the outbox-relay worker's legitimate
-- cross-tenant sweep of domain_event_outbox (a system-level background
-- process has to see every tenant's pending rows, not just one), and forcing
-- it on the ~20 other existing tables risks breaking every existing test
-- that seeds/cleans up fixture data as the owner role without ever setting
-- tenant context. That's a larger, cross-cutting fix beyond this ADR's
-- scope, tracked separately.
--
-- What IS in scope here: a real, restricted, non-owner "app_user" role that
-- does NOT bypass RLS, so the RLS policies themselves can be verified to
-- actually enforce isolation for any connection that isn't the owner — this
-- is what the adversarial test in src/rls-policy.spec.ts connects as. Making
-- the *running application* connect through a role like this (rather than
-- the owner) for tenant-scoped request-path queries, while keeping
-- owner/admin credentials for migrations and genuinely system-level
-- processes like the outbox relay, is the real fix and is intentionally left
-- to the tracked follow-up rather than bundled into this migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_only_change_in_prod' NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
