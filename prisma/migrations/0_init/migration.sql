-- CreateTable tenants
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable message_queue
CREATE TABLE "message_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable metrics
CREATE TABLE "metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex users.tenantId_email_key
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex users.tenantId_idx
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex message_queue.tenantId_idx
CREATE INDEX "message_queue_tenantId_idx" ON "message_queue"("tenantId");

-- CreateIndex message_queue.status_idx
CREATE INDEX "message_queue_status_idx" ON "message_queue"("status");

-- CreateIndex metrics.tenantId_idx
CREATE INDEX "metrics_tenantId_idx" ON "metrics"("tenantId");

-- CreateIndex metrics.timestamp_idx
CREATE INDEX "metrics_timestamp_idx" ON "metrics"("timestamp");

-- AddForeignKey users -> tenants
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metrics" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "users_tenant_isolation" ON "users" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);

-- Create RLS policies for message_queue table
CREATE POLICY "message_queue_tenant_isolation" ON "message_queue" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);

-- Create RLS policies for metrics table
CREATE POLICY "metrics_tenant_isolation" ON "metrics" USING (
  "tenantId" = (current_setting('row_security_context.tenant_id')::UUID)
);
