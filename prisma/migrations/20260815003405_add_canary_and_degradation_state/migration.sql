-- CreateTable
CREATE TABLE "canary_rollout_state" (
    "id" TEXT NOT NULL,
    "productionVersion" TEXT NOT NULL,
    "canaryVersion" TEXT,
    "canaryPercentage" INTEGER NOT NULL DEFAULT 0,
    "betaTenantIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canary_rollout_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_provider_degradation" (
    "id" TEXT NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "failureThreshold" INTEGER NOT NULL DEFAULT 5,
    "cooldownMs" INTEGER NOT NULL DEFAULT 60000,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_provider_degradation_pkey" PRIMARY KEY ("id")
);
