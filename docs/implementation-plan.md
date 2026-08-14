# Implementation Plan: Cross-Platform Email Triage SaaS

## Overview

This document provides a dependency-ordered, staged series of implementation prompts for building a cross-platform (Gmail + Outlook) email triage/classification SaaS system. It bridges the deep research report (`.plans/email-sorting-system-research.md`), the 22 Architecture Decision Records (`docs/adr/0001-*.md` through `docs/adr/0022-*.md`), and the 10 Domain-Driven-Design bounded-context docs (`docs/ddd/contexts/*.md` plus `docs/ddd/context-map.md`) with concrete, self-contained implementation briefs.

Each stage below can be handed to a coding agent as a complete build brief, with explicit reasoning for build order and citations to all relevant ADRs and DDD context docs.

## Table of Contents

- [Cross-Cutting ADR Map](#cross-cutting-adr-map)
- [Stage 0: Platform & Cross-Cutting Foundations](#stage-0--platform--cross-cutting-foundations)
- [Stage 1: Tenant & Subscription](#stage-1--tenant--subscription)
- [Stage 2: Identity & Access](#stage-2--identity--access)
- [Stage 3: Mailbox Ingestion](#stage-3--mailbox-ingestion)
- [Stage 4: Classification](#stage-4--classification)
- [Stage 5: Contact Graph](#stage-5--contact-graph)
- [Stage 6: Threat Detection](#stage-6--threat-detection)
- [Stage 7: Prioritization](#stage-7--prioritization)
- [Stage 8: Mailbox Write-back / Sync](#stage-8--mailbox-write-back--sync)
- [Stage 9: Feedback & Learning](#stage-9--feedback--learning)
- [Stage 10: Notification & Alerting](#stage-10--notification--alerting)
- [Stage 11: Public/Internal API & Client Surface](#stage-11--publicinternal-api--client-surface)
- [Stage 12: Deployment Hardening, Safe-Rollout Completion & Disaster Recovery](#stage-12--deployment-hardening-safe-rollout-completion--disaster-recovery)
- [Coverage Verification](#coverage-verification)

---

## Cross-Cutting ADR Map

The following table shows which Architecture Decision Records are established in which stage, and in which later stages they are honored/extended:

| ADR | Established | Honored & Extended |
|-----|-------------|-------------------|
| [ADR 0001: Server-Side Middleware SaaS Architecture](adr/0001-server-side-middleware-saas-architecture.md) | Stage 0 | — (umbrella decision) |
| [ADR 0002: Technology Stack Selection](adr/0002-technology-stack-selection.md) | Stage 0 | Honored by all subsequent stages |
| [ADR 0003: Platform Normalization Layer](adr/0003-platform-normalization-layer.md) | Stage 3 | Stage 8 (write-back translation) |
| [ADR 0004: Real-Time Ingestion with Delta-Sync Backstop](adr/0004-real-time-ingestion-with-delta-sync-backstop.md) | Stage 3 | — |
| [ADR 0005: Tiered Classification Pipeline](adr/0005-tiered-classification-pipeline.md) | Stage 4 | Stage 5 (narrow tier-1 applicability) |
| [ADR 0006: Multi-Label Classification Data Model](adr/0006-multi-label-classification-data-model.md) | Stage 4 | Stage 7, Stage 8 |
| [ADR 0007: LLM Provider/Model Tiering & Cost Governance](adr/0007-llm-provider-model-tiering-cost-governance.md) | Stage 4 | Stage 6 (threat intent classification) |
| [ADR 0008: Rule Engine Ownership](adr/0008-rule-engine-ownership.md) | Stage 4 | — |
| [ADR 0009: Prioritization/Urgency Scoring Model](adr/0009-prioritization-urgency-scoring-model.md) | Stage 7 | — |
| [ADR 0010: Phishing Detection Layering & Incident Response Policy](adr/0010-phishing-detection-layering-and-incident-response.md) | Stage 6 | — |
| [ADR 0011: Personal Contact & Relationship-Graph Heuristics](adr/0011-personal-contact-relationship-graph-heuristics.md) | Stage 5 | — |
| [ADR 0012: OAuth Token Lifecycle & Secrets Management](adr/0012-oauth-token-lifecycle-secrets.md) | Stage 2 | Stage 3 (credential status), Stage 12 (secrets-store replication) |
| [ADR 0013: Data Retention, Encryption & Privacy](adr/0013-data-retention-encryption-privacy.md) | Stage 2/3 | Stage 5, Stage 9 |
| [ADR 0014: Feedback Loop & Continuous Learning](adr/0014-feedback-loop-continuous-learning.md) | Stage 9 | — |
| [ADR 0015: Multi-Tenancy & Data Isolation](adr/0015-multi-tenancy-data-isolation.md) | Stage 0 | Honored by every subsequent stage |
| [ADR 0016: Observability, SLAs & Alerting](adr/0016-observability-slas-alerting.md) | Stage 0 (skeleton) | Stage 3 (concrete targets), Stage 6, Stage 8, Stage 10 |
| [ADR 0017: Scalability, Queueing & Autoscaling](adr/0017-scalability-queueing-autoscaling.md) | Stage 0 (skeleton) | Stage 3 (full topology), Stage 4, Stage 8 |
| [ADR 0018: Deployment, CI/CD & Safe Rollout](adr/0018-deployment-cicd-safe-rollout.md) | Stage 0 (CI gates) | Stage 4 (shadow-eval/canary), Stage 7, Stage 9, Stage 12 (completion) |
| [ADR 0019: Disaster Recovery & Business Continuity](adr/0019-disaster-recovery-business-continuity.md) | Stage 12 | — |
| [ADR 0020: Public/Internal API Design](adr/0020-public-internal-api-design.md) | Stage 11 | — |
| [ADR 0021: Usage Metering & Billing](adr/0021-usage-metering-billing.md) | Stage 1 | Honored at every usage-producing stage (3, 4, 8, 10) |
| [ADR 0022: Testing & Evaluation Strategy](adr/0022-testing-and-evaluation-strategy.md) | Stage 0 (pyramid) | Stage 4 (classification eval harness), Stage 6 (phishing threshold), throughout |

---

## Stage 0 — Platform & Cross-Cutting Foundations

### Goal

Stand up the typed service skeleton, tenant-isolated data layer, CI gates, and observability/queue scaffolding every later stage depends on.

### Why This Stage Now

This is the substrate. Nothing else—no aggregate, no ACL, no event—can be built before a typed backend, an RLS-enforced Postgres schema, and CI gates exist to govern every subsequent classification-affecting change ([ADR 0018](adr/0018-deployment-cicd-safe-rollout.md)/[ADR 0022](adr/0022-testing-and-evaluation-strategy.md) both presuppose this). Per [context-map.md](ddd/context-map.md), multi-tenancy is explicitly "enforced at the persistence/infrastructure layer beneath every context, not modeled as its own bounded context"—so this stage, not any bounded-context stage, is where TenantId-partitioning becomes real.

### Bounded Context(s) in Scope

None directly—this is the infra layer beneath all 10 contexts. No aggregates ship here; this stage produces the repository/RLS/queue/CI substrate every later aggregate's repository interfaces (ports) will be implemented against.

### Governing ADRs

- [ADR 0001](adr/0001-server-side-middleware-saas-architecture.md) (server-side middleware SaaS architecture—the umbrella decision)
- [ADR 0002](adr/0002-technology-stack-selection.md) (technology stack: TypeScript/Node LTS, NestJS, PostgreSQL, Redis, BullMQ, Prisma, Anthropic SDK)
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (multi-tenancy & RLS—shared-schema-with-tenant-id, `SET LOCAL` tenant context as first operation in every handler, CI check failing the build if a tenant-scoped table lacks an RLS policy)
- [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) (CI pipeline gates: type-check, tests, RLS-policy-coverage check, secrets/dependency scan—shadow-eval/canary deferred to Stage 4)
- [ADR 0022](adr/0022-testing-and-evaluation-strategy.md) (conventional test pyramid: unit tests, integration tests against mocked platform responses, E2E scaffolding, and adversarial RLS cross-tenant-read/write tests—classification eval harness deferred to Stage 4)
- [ADR 0016](adr/0016-observability-slas-alerting.md) (observability skeleton: SLI plumbing and alert-routing infrastructure, without yet the concrete ≤2min/≤15min targets, which are Stage 3)
- [ADR 0017](adr/0017-scalability-queueing-autoscaling.md) (initial BullMQ/Redis queue skeleton—the criticality-tiered topology itself is fully built in Stage 3)

### Implementation Prompt

> Build the foundational NestJS/TypeScript service skeleton on Node LTS with Prisma-backed PostgreSQL and a Redis-backed BullMQ instance, per [ADR 0002](adr/0002-technology-stack-selection.md). Every table that will ever be tenant-scoped must be created with a `tenant_id` column and a corresponding Postgres row-level-security policy from day one; implement a NestJS interceptor/middleware that sets tenant context (`SET LOCAL`) as the literal first operation of every request/job handler, sourced only from authenticated request/job context, never client input, per [ADR 0015](adr/0015-multi-tenancy-data-isolation.md). Add a CI pipeline (type-check, unit/integration test run, a policy-coverage check that fails the build if any new tenant-scoped table lacks an RLS policy, and a secrets/dependency scanner) per [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md)'s CI-gate requirements. Stand up the base observability skeleton (structured logging, SLI emission scaffolding, an alert-routing target) per [ADR 0016](adr/0016-observability-slas-alerting.md), and a minimal BullMQ queue skeleton per [ADR 0017](adr/0017-scalability-queueing-autoscaling.md) (to be expanded into the full criticality-based topology in the Mailbox Ingestion stage). Write an adversarial RLS test suite that attempts cross-tenant reads/writes against a seeded two-tenant fixture and asserts denial, per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md). Done = CI pipeline runs green on an empty-but-structured repo, the RLS cross-tenant test suite passes and blocks the build if a policy is ever missing, and a health-check endpoint plus one dummy metrics/log line prove the observability path is wired end-to-end.

---

## Stage 1 — Tenant & Subscription

### Goal

Build the commercial root—Plan/Entitlement catalog, Subscription and UsageMeter aggregates, billing-provider ACL—that every other context reads as a conformist.

### Why This Stage Now

Per [context-map.md](ddd/context-map.md)'s relationship table, [Tenant & Subscription](ddd/contexts/tenant-subscription.md) is upstream of Identity & Access, Mailbox Ingestion, Classification, and Prioritization via Open Host Service/Published Language on `PlanEntitlementsChanged`—every one of those contexts is a conformist reader of entitlements (mailbox count, LLM-tier ceiling, scoring-weight customization). Building anything downstream first would mean guessing at entitlement shape rather than reading it.

### Bounded Context(s) in Scope

[Tenant & Subscription](ddd/contexts/tenant-subscription.md). Aggregates: `Subscription` (identity: TenantId; one active Plan at a time, versioned PlanChanged transitions, TenantSuspended after grace period), `UsageMeter` (identity: (TenantId, MeterType, BillingPeriod); pure accumulator over published facts from other contexts, never estimates independently). Value objects: Plan, Entitlement, MeterReading, BillingPeriod. Events: `PlanEntitlementsChanged`, `UsageOverageDetected`, `TenantSuspended`, `SubscriptionBillingEventRecorded`.

### Governing ADRs

- [ADR 0021](adr/0021-usage-metering-billing.md) (usage metering & billing integration—Plan model, overage handling, billing-provider integration, cost-model validation loop) is the primary/established ADR
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored—every table gets TenantId+RLS per Stage 0's pattern)
- [ADR 0013](adr/0013-data-retention-encryption-privacy.md) (privacy, honored—billing/usage data minimization)

### Implementation Prompt

> Implement the [Tenant & Subscription](ddd/contexts/tenant-subscription.md) bounded context per its DDD doc. Build the `Subscription` aggregate root (TenantId-keyed, exactly one active Plan, PlanChanged as a versioned transition never an in-place mutation) and the `UsageMeter` aggregate root ((TenantId, MeterType, BillingPeriod)-keyed, atomic-increment-only, raising `UsageOverageDetected` exactly once per threshold crossing per period). Implement `SubscriptionRepository`, `UsageMeterRepository` (with atomic increment support), and `PlanCatalogRepository`. Build a `BillingProviderAdapter` implementing a `BillingProviderPort` (createSubscription, changePlan, recordUsageCharge, handlePaymentWebhook) against a Stripe-shaped external billing provider per [ADR 0021](adr/0021-usage-metering-billing.md), translating inbound payment-failure webhooks into `Subscription.PastDue` state transitions rather than leaking the provider's webhook schema into the domain. Publish `PlanEntitlementsChanged`, `UsageOverageDetected`, `TenantSuspended`, and `SubscriptionBillingEventRecorded` as the durable, versioned published-language events every later stage's conformist reads will depend on. Note: `UsageMeter` will not receive real usage facts until Stages 3/4/8/10 exist and start publishing them—build this stage against synthetic/test usage events and defer end-to-end metering verification to a cross-stage integration test once those producers exist. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), unit tests cover Plan-change versioning and overage-threshold-crossing-exactly-once; an integration test simulates a billing-provider payment-failure webhook and asserts correct `PastDue` transition.

---

## Stage 2 — Identity & Access

### Goal

Build Tenant/User/MailboxAuthorization aggregates and the Google/Microsoft OAuth ACLs that issue and rotate the scope-minimized credentials every mailbox-touching context depends on.

### Why This Stage Now

Downstream of [Tenant & Subscription](ddd/contexts/tenant-subscription.md) (conformist on PlanEntitlements for application-vs-delegated permission eligibility and tenant-suspension cascading—[context-map.md](ddd/context-map.md)). Upstream of every mailbox-touching context ([Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) directly, Write-back indirectly) via Open Host Service/Published Language on `MailboxAuthorized`/`MailboxCredentialRevoked`—nothing can sync a mailbox before this exists. Building Mailbox Ingestion first would have no credential to sync against.

### Bounded Context(s) in Scope

[Identity & Access](ddd/contexts/identity-access.md). Aggregates: `Tenant` (identity-facing projection; status active/suspended/deleted gates whether any MailboxAuthorization may sync), `MailboxAuthorization` (identity: (TenantId, UserId, MailboxId); ScopeSet can never exceed minimal-required-set by construction, Credential's refresh token held only as a CredentialHandle reference into a secrets vault, every ScopeSet change requires a fresh ConsentGrant). Entities/VOs: ConsentGrant, CredentialHandle, ScopeSet, User. Events: `MailboxAuthorized`, `CredentialRotated`, `MailboxCredentialRevoked`, `TenantSuspended` (consumed, cascades to revoke authorizations).

### Governing ADRs

- [ADR 0012](adr/0012-oauth-token-lifecycle-secrets.md) (OAuth scope minimization, token lifecycle & secrets management) is the primary/established ADR—request exactly `gmail.modify`+`gmail.labels` and Graph `Mail.ReadWrite`+`MailboxSettings.ReadWrite`, never broader scopes; refresh tokens in a managed secrets store keyed per tenant-mailbox, never application DB rows; rotation on every supported refresh
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored)
- [ADR 0013](adr/0013-data-retention-encryption-privacy.md) (privacy, touched—ConsentGrant tracking and per-scope consent-screen justification feed the DPA/compliance artifact)

### Implementation Prompt

> Implement the [Identity & Access](ddd/contexts/identity-access.md) bounded context per its DDD doc. Build the `Tenant` aggregate (status gates sync eligibility independent of billing state) and the `MailboxAuthorization` aggregate root, enforcing by construction that `ScopeSet` cannot exceed `gmail.modify`+`gmail.labels` (Gmail) or `Mail.ReadWrite`+`MailboxSettings.ReadWrite` delegated permissions (Graph), per [ADR 0012](adr/0012-oauth-token-lifecycle-secrets.md)—reject any wider scope request unless the tenant's `PlanEntitlements` (read as a conformist from Stage 1) explicitly flags application-level/daemon access eligibility. Build `GoogleOAuthAdapter` and `MicrosoftIdentityAdapter` implementing one `OAuthProviderPort` (initiateConsent, exchangeCode, refreshToken, revoke), isolating Google's CASA-assessment requirement for >100-user restricted scopes and Microsoft's delegated-vs-application/admin-consent model behind normalized `ScopeSet` values. Wire a `SecretsVaultPort` backed by a managed KMS-backed secrets store—`CredentialHandle` in the aggregate is only ever an opaque reference, never the raw token. Publish `MailboxAuthorized` on successful grant completion, `MailboxCredentialRevoked` on any path to an unusable credential (user-revoked, platform-invalidated, admin-revoked, tenant-suspended), and consume `TenantSuspended` from Stage 1 to cascade-revoke. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), an integration test drives a full OAuth grant→refresh→revoke cycle against sandboxed Google/Microsoft OAuth responses; a unit test asserts a scope-widening attempt without a fresh ConsentGrant is rejected; a security-review checklist confirms no raw token ever appears in a database row, log line, or API response.

---

## Stage 3 — Mailbox Ingestion

### Goal

Build the dual-path (webhook + delta-sync backstop) sync engine and the Gmail/Outlook normalization ACL that produces `MessageIngested`—the system's primary published-language event.

### Why This Stage Now

Downstream of [Identity & Access](ddd/contexts/identity-access.md) (needs live, scope-minimized credentials to establish a watch/subscription at all) and [Tenant & Subscription](ddd/contexts/tenant-subscription.md) (conformist on mailbox-count/sync-frequency entitlements). Upstream of Classification, Threat Detection, and Contact Graph—all three subscribe to `MessageIngested` as their sole trigger and source of `MessageEnvelope` data ([context-map.md](ddd/context-map.md)). Building any content-driven context first would have nothing to classify.

### Bounded Context(s) in Scope

[Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md). Aggregates: `MailboxConnection` (identity: (TenantId, MailboxId); at most one active WatchSubscription per (MailboxId, Platform), SyncCursor only moves forward, halts on revoked/expired credential rather than retrying indefinitely), `IngestedMessage` (identity: (TenantId, MessageId)—internally minted UUID distinct from platform-native IDs; normalization is idempotent, immutable once created). Entities/VOs: WatchSubscription, SyncCursor, MessageEnvelope, PlatformMessageRef, CredentialStatus. Events: `MessageIngested`, `MailboxSyncFailed`, `WatchSubscriptionExpiringSoon`, `MailboxConnectionRevoked`.

### Governing ADRs

- [ADR 0003](adr/0003-platform-normalization-layer.md) (platform normalization layer—one internal `NormalizedMessage`/`MessageEnvelope` shape, thin per-platform adapters)
- [ADR 0004](adr/0004-real-time-ingestion-with-delta-sync-backstop.md) (real-time ingestion: webhook push plus mandatory delta-sync backstop—dual-path design, 5-minute default reconciliation interval, scheduled watch/subscription renewal) are the primary/established ADRs
- [ADR 0017](adr/0017-scalability-queueing-autoscaling.md) (scalability/queueing) is fully established here: separate BullMQ queues for urgent-path vs. standard-path ingestion, webhook/renewal jobs, and delta-sync sweeps, plus a centralized Redis-backed per-platform token-bucket rate limiter shared across autoscaled workers
- [ADR 0016](adr/0016-observability-slas-alerting.md) is concretized here: this is where the ≤2min (time-critical) / ≤15min (standard) SLA targets from research §6 open decision #4 first become architecturally real, since meeting them requires a fast Tier-1-style pre-triage signal to route a message onto the urgent path before full classification completes
- [ADR 0013](adr/0013-data-retention-encryption-privacy.md) is established here: full message bodies are not embedded in `MessageEnvelope`/`MessageIngested`—`bodyRef` points at a short-retention content store
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored)

### Implementation Prompt

> Implement the [Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) bounded context per its DDD doc. Build `GmailIngestionAdapter` and `OutlookIngestionAdapter` implementing one `MailboxSyncPort` (establishWatch, renewWatch, pullDelta, fetchMessage) per [ADR 0003](adr/0003-platform-normalization-layer.md), normalizing every inbound message into one `MessageEnvelope` value object (headers-of-interest preserved verbatim for downstream rule evaluation—List-Unsubscribe, Precedence, Auto-Submitted, List-Id, SPF/DKIM/DMARC results—plus threadRef, hasCalendarPart, attachmentSummaries)—raw MIME parsing (e.g., detecting text/calendar;METHOD=CANCEL) happens inside the adapter so nothing above it sees raw MIME. Implement the `MailboxConnection` aggregate's dual-path sync per [ADR 0004](adr/0004-real-time-ingestion-with-delta-sync-backstop.md): a push-triggered handler that only enqueues a delta-fetch job (never trusts the notification payload as complete), plus an independent, scheduled reconciliation sweep (default 5 min) that is authoritative regardless of webhook delivery—and a renewal scheduler for Gmail's 7-day watch and Graph's ~3-day subscription lifetimes that pages on-call on renewal failure per [ADR 0016](adr/0016-observability-slas-alerting.md). Build the full BullMQ queue topology from [ADR 0017](adr/0017-scalability-queueing-autoscaling.md): separate queues for urgent-path vs. standard-path ingestion, webhook/renewal jobs, and delta-sync sweeps, backed by a centralized Redis token-bucket rate limiter enforcing Gmail's 250 units/user/sec and Graph's 10k req/10min/mailbox ceilings across the whole autoscaled worker pool, not per-worker. Ensure `bodyRef` points at a short-TTL content store per [ADR 0013](adr/0013-data-retention-encryption-privacy.md) rather than embedding body text in `MessageEnvelope`. Publish `MessageIngested` (idempotent per (MailboxId, PlatformMessageRef)—redelivered webhooks and overlapping sweeps must resolve to the same MessageId) via a transactional outbox. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), integration tests against sandboxed/mocked Gmail and Graph responses cover webhook-then-reconcile convergence, redelivery idempotency, and SyncCursor-never-moves-backward; a load test demonstrates the rate limiter holds worker pool throughput under platform quota ceilings; an alert fires in a test environment on simulated watch-renewal failure.

---

## Stage 4 — Classification

### Goal

Build the `MessageClassification` aggregate and the three-tier rules→cheap-LLM→frontier-LLM pipeline that assigns the eight self-owned category labels plus `NeedsReply`.

### Why This Stage Now

Downstream of [Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) (`MessageIngested` is its sole trigger) and [Tenant & Subscription](ddd/contexts/tenant-subscription.md) (conformist on LLM-tier ceiling entitlements). This is the system's core-value context and the first classification-producing context, so it is also where the classification-accuracy eval harness and shadow-eval/canary safe-rollout machinery (needed by every later classification-affecting stage) get built for the first time. Must exist before Prioritization (needs `NeedsReply`) or Write-back (needs `MessageClassified`).

### Bounded Context(s) in Scope

[Classification](ddd/contexts/classification.md). Aggregate: `MessageClassification` (identity: (TenantId, MessageId); tiers attempted strictly in order Rule→CheapLlm→FrontierLlm; result set is multi-label—zero, one, or several of the eight self-owned categories, each with its own confidence/source tier; Finalized and immutable except via explicit Feedback-triggered Reclassified; `NeedsReply` cannot be assigned to a message already carrying strong automated-sender rule signals, enforced as an invariant not LLM discretion). Entities/VOs: LabelAssignment, ClassificationRun, RuleSignalSet, TaxonomyVersion. Events: `MessageClassified`, `ClassificationEscalatedToLlm`, `ClassificationLowConfidence`, `MessageReclassified`.

### Governing ADRs

- [ADR 0005](adr/0005-tiered-classification-pipeline.md) (tiered classification pipeline architecture)
- [ADR 0006](adr/0006-multi-label-classification-data-model.md) (multi-label classification data model—`message_labels` normalized table, not a denormalized array)
- [ADR 0007](adr/0007-llm-provider-model-tiering-cost-governance.md) (LLM provider/model tiering & cost governance—Anthropic exclusively, Haiku-class Tier 2, Sonnet/Opus-class Tier 3, interactive vs. Batch API routing, per-tenant soft/hard budget ceilings)
- [ADR 0008](adr/0008-rule-engine-ownership.md) (rule engine ownership—all Tier 1 logic stays centrally authoritative, never delegated to native Gmail filters/Outlook message rules)

This stage also establishes [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md)'s shadow-evaluation + canary machinery for classification-affecting changes (rule/prompt/threshold changes tied to `pipeline_version`) and [ADR 0022](adr/0022-testing-and-evaluation-strategy.md)'s classification-accuracy eval harness (golden dataset stratified for the boundary-ambiguous cases—LinkedIn-digest-with-a-job-posting, Sales&Deals-vs-Newsletter—per-category precision/recall/F1, not aggregate accuracy)—both of which every later classification-affecting stage (Threat Detection, Prioritization, Feedback & Learning) will reuse rather than rebuild.

### Implementation Prompt

> Implement the [Classification](ddd/contexts/classification.md) bounded context per its DDD doc. Build the `MessageClassification` aggregate enforcing strict tier ordering (Rule before CheapLlm before FrontierLlm) per [ADR 0005](adr/0005-tiered-classification-pipeline.md), with per-category-configurable confidence thresholds (not one global cutoff—e.g., METHOD:CANCEL detection defaults near-deterministic, NeedsReply defaults to a lower Tier-1 threshold routing more volume onward). Implement the Tier 1 `RuleSignalEvaluator` port covering: sender/brand-watchlist match, List-Unsubscribe/Precedence:bulk/Auto-Submitted/List-Id header presence, SPF/DKIM/DMARC pass-fail, text/calendar;METHOD=CANCEL detection, schema.org/JSON-LD e-commerce markup, and thread-state (last sender != mailbox owner)—enforce as a hard invariant that `NeedsReply` cannot be assigned when strong automated-sender signals are present, regardless of what a later LLM tier would say. Build `LlmClassifierAdapter` implementing `ClassifierPort.classify(tier, request)` against the Anthropic API per [ADR 0007](adr/0007-llm-provider-model-tiering-cost-governance.md): Haiku-class for Tier 2 (structured JSON output, ~5 few-shot examples per category), Sonnet-class default / Opus-class escalation for Tier 3, routing phishing-adjacent/needs-reply-candidate/prioritization-relevant messages through interactive pricing and Tier-1-resolved confirmation/backfill traffic through the Batch API—meter every call's tokens/tier back to [Tenant & Subscription](ddd/contexts/tenant-subscription.md)'s UsageMeter (Stage 1) per [ADR 0021](adr/0021-usage-metering-billing.md), and enforce per-tenant soft/hard budget ceilings that degrade to cheaper-tier routing rather than dropping a message. Persist labels per [ADR 0006](adr/0006-multi-label-classification-data-model.md) as `message_labels` rows, one per (Category, confidence, sourceTier). Do NOT delegate any Tier-1 logic to native Gmail filters or Outlook message rules per [ADR 0008](adr/0008-rule-engine-ownership.md)—write-back-only use of native primitives is deferred to Stage 8. Build the golden-dataset eval harness (hand-labeled, stratified for the ambiguous LinkedIn/Jobs and Sales&Deals/Newsletter boundaries) and wire it into a shadow-evaluation gate that scores any rule/prompt/threshold change against it before promotion, plus a canary-rollout mechanism keyed to `pipeline_version`, per [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md). Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), per-category precision/recall/F1 are tracked on a dashboard (not just aggregate accuracy), a shadow-eval run against the golden dataset blocks a deliberately-regressed test change, and cost-per-tenant-per-day stays within the modeled budget ceiling under a synthetic high-volume load test.

---

## Stage 5 — Contact Graph

### Goal

Build the `SenderProfile` aggregate and the weighted personal-vs-automated scoring, VIP designation, and interaction-history tracking.

### Why This Stage Now

Downstream of [Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) only (does not need Classification's output)—but must be built before Threat Detection, which per [threat-detection.md](ddd/contexts/threat-detection.md) sources its `CorrespondenceHistoryReadModel` (has-the-owner-emailed-this-domain-before, needed for lookalike scoring) from Contact Graph rather than recomputing it. It must also precede [Prioritization](ddd/contexts/prioritization.md), which is downstream of Contact Graph for VIP status and interaction frequency ([context-map.md](ddd/context-map.md)).

### Bounded Context(s) in Scope

[Contact Graph](ddd/contexts/contact-graph.md). Aggregate: `SenderProfile` (identity: (TenantId, MailboxId, SenderAddressOrDomain)—per-mailbox, not global; ContactClassification is always a weighted composite, never a single hard gate; VipDesignation can only be true if Personal or set by explicit manual action; InteractionHistory counters only move forward; auto-promotion to VIP requires sustained bidirectional interaction, not a single reply). Entities/VOs: ContactClassification, AutomatedSenderSignal, InteractionEvent, VipDesignation, ContactsApiMatch. Events: `SenderClassified`, `ContactPromotedToVip`, `InteractionFrequencyUpdated`.

### Governing ADRs

- [ADR 0011](adr/0011-personal-contact-relationship-graph-heuristics.md) (personal contact & relationship-graph detection heuristics—weighted score combining automation-header absence, From-address pattern, Contacts-API presence, bidirectional thread history, display-name heuristic; entirely Tier-1/rule-tier, no LLM call) is the primary/established ADR
- [ADR 0013](adr/0013-data-retention-encryption-privacy.md) (privacy, honored—explicitly flagged in the ADR itself as sensitive relationship-graph data about the tenant's own social/professional graph, requiring the same retention/encryption/isolation posture as email content, not "just metadata")
- [ADR 0005](adr/0005-tiered-classification-pipeline.md)'s tiered-pipeline concept is honored narrowly (Tier-1-only, no escalation ladder needed since all signals are structural)

### Implementation Prompt

> Implement the [Contact Graph](ddd/contexts/contact-graph.md) bounded context per its DDD doc. Build the `SenderProfile` aggregate root, keyed per (TenantId, MailboxId, SenderAddressOrDomain), computing `ContactClassification` as a weighted composite per [ADR 0011](adr/0011-personal-contact-relationship-graph-heuristics.md)—automation-header absence (List-Unsubscribe/Precedence:bulk/Auto-Submitted/List-Id, high weight), From-address pattern (not noreply@/no-reply@/notifications@, medium weight), Contacts-API presence (high weight), bidirectional thread history (has the owner sent TO this address, high weight—reuse the same thread-state signal Classification computes for NeedsReply, do not duplicate the lookup), and display-name heuristic (low weight, tie-breaker only)—never a hard gate on any single signal. Implement append-only `InteractionEvent` logging feeding a windowed `InteractionFrequencyUpdated` recompute (periodic, not per-message, to avoid event storms), and VIP auto-promotion gated on a configurable minimum sustained bidirectional-interaction count within a rolling window (manual VIP designation always overrides the automated classifier). Build `ContactsApiAdapter` behind a narrow `lookupContact(mailboxId, address)` port wrapping Gmail People API and Graph contacts—existence/match lookup only; all frequency computation stays native domain logic, never delegated to the platform API, per research §1.1's finding that neither platform's contacts API exposes an interaction-frequency score itself. Publish `SenderClassified`, `ContactPromotedToVip`, `InteractionFrequencyUpdated`. Ensure this data is covered by the same encryption-at-rest and per-tenant RLS posture as email content per [ADR 0013](adr/0013-data-retention-encryption-privacy.md), since it's flagged as sensitive relationship-graph data, not incidental metadata. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), unit tests confirm no single automated-sender signal alone forces Personal or Automated classification, and an integration test confirms VIP auto-promotion requires sustained (not single-reply) interaction within the configured window.

---

## Stage 6 — Threat Detection

### Goal

Build the `ThreatAssessment` aggregate and the three-layer (authentication, lookalike-domain, LLM intent) phishing/BEC detection and severity-tiered quarantine policy.

### Why This Stage Now

Downstream of [Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) (header/domain data) AND [Contact Graph](ddd/contexts/contact-graph.md)—its `CorrespondenceHistoryReadModel` port is explicitly sourced from Contact Graph, not recomputed, per [threat-detection.md](ddd/contexts/threat-detection.md), so this stage cannot be correctly built (lookalike scoring would have no "has this domain been corresponded with before" signal) until Stage 5 exists.

### Bounded Context(s) in Scope

[Threat Detection](ddd/contexts/threat-detection.md). Aggregate: `ThreatAssessment` (identity: (TenantId, MessageId); all three layers independently computable and independently nullable—a message can be flagged on a failed DMARC check alone without waiting on the slower LLM layer; once Quarantine is decided the assessment is Locked, reversible only by explicit AdminOverride; IntentClassification layer only invoked when auth+lookalike layers don't already produce a high-confidence verdict, mirroring Classification's cost-tiering philosophy but with its own independent tier state). Entities/VOs: AuthenticationSignal, LookalikeScore, IntentClassification, QuarantineDecision, ThreatDetectionTier. Events: `MessageThreatAssessed`, `MessageQuarantined`, `QuarantineOverridden`.

### Governing ADRs

- [ADR 0010](adr/0010-phishing-detection-layering-and-incident-response.md) (phishing detection layering & incident response policy—the severity-tiered quarantine-vs-soft-flag policy, resolving research §6 open decision #3) is the primary/established ADR
- [ADR 0007](adr/0007-llm-provider-model-tiering-cost-governance.md) (LLM provider/tiering, honored—reuses the `ClassifierPort` abstraction from Stage 4 with a distinct adapter instance and independently-versioned threat-specific system prompting, Sonnet/Opus-class for intent classification)
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored—the brand watchlist is this system's one deliberate global/cross-tenant table, explicitly carved out and separated from tenant-scoped tables per the RLS pattern established Stage 0)
- [ADR 0022](adr/0022-testing-and-evaluation-strategy.md) is extended here: phishing false-negative rate on high-confidence quarantine actions is defined as the single most safety-critical, non-negotiable metric added to the golden-dataset eval harness built in Stage 4

### Implementation Prompt

> Implement the [Threat Detection](ddd/contexts/threat-detection.md) bounded context per its DDD doc. Build the `ThreatAssessment` aggregate with three independently-computable, independently-nullable layers per [ADR 0010](adr/0010-phishing-detection-layering-and-incident-response.md): (1) `AuthenticationSignal`—SPF/DKIM/DMARC pass/fail/none plus alignment, combined with display-name brand-impersonation matching as the cheapest, highest-value signal; (2) `LookalikeScore`—string-distance/homoglyph comparison of sender domain against a `BrandWatchlistRepository` (the one deliberate global/shared table in the system per [ADR 0015](adr/0015-multi-tenancy-data-isolation.md)—implement it in its own clearly-separated schema/namespace, never as an RLS-bypass fallback) AND against the tenant's own prior-correspondence domains, read via a `CorrespondenceHistoryReadModel` port sourced from Stage 5's Contact Graph, never recomputed locally; (3) `IntentClassification`—a `ThreatIntentClassifierAdapter` reusing Stage 4's `ClassifierPort` abstraction but as a distinct, independently-versioned adapter instance with threat-specific system prompting and a narrow output schema (CredentialHarvesting|BEC|MalwareDelivery|None), invoked only when layers 1-2 don't already yield a high-confidence verdict. Implement the severity-tiered `QuarantineDecision` policy: high-confidence (failed DMARC + brand impersonation + malicious pattern, or high-confidence Tier-3 intent) triggers reversible Quarantine (Locked state, distinct Gmail label/Outlook folder, never comingled with the 11-category taxonomy); medium-confidence triggers a soft `phishing_flag: flagged` alongside normal routing. Optionally wrap Google Safe Browsing/VirusTotal behind a pluggable `ThreatIntelAdapter` per the ACL notes—explicitly do not wrap Defender for O365 or Gmail's own pre-delivery filtering, this context only ever sees mail that already survived those. Publish `MessageThreatAssessed`, the narrower urgent `MessageQuarantined`, and `QuarantineOverridden` (consumed by Feedback & Learning in Stage 9 as a high-trust AdminOverride-only correction type—an ordinary user correction cannot reverse a Locked quarantine). Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), the phishing false-negative rate on high-confidence quarantine actions is tracked as a separate, non-negotiable threshold on the golden-dataset dashboard from Stage 4, and a shadow-eval run demonstrates a threshold/prompt change that would raise the false-negative rate is blocked from promotion regardless of aggregate-accuracy improvement elsewhere.

---

## Stage 7 — Prioritization

### Goal

Build the `MessagePriority` aggregate computing the 0-100 composite weighted urgency score.

### Why This Stage Now

Downstream of both [Classification](ddd/contexts/classification.md) (Stage 4, for the mandatory `NeedsReply` input—scoring is disallowed before a `MessageClassified` fact exists, per [prioritization.md](ddd/contexts/prioritization.md)'s `PendingSignals` invariant) and [Contact Graph](ddd/contexts/contact-graph.md) (Stage 5, for VIP status and interaction frequency). Both must exist first. Independent of Threat Detection, so could in principle parallelize with Stage 6; sequenced after it here since Stage 6 was the harder dependency (on Stage 5) to resolve first.

### Bounded Context(s) in Scope

[Prioritization](ddd/contexts/prioritization.md). Aggregate: `MessagePriority` (identity: (TenantId, MessageId); stays `PendingSignals` until required inputs arrive; score always [0,100], each ScoreComponent independently bounded and auditable—sum-and-clamp, not an opaque model output; re-scoring is idempotent given the same inputs; NeedsReply aging monotonically increases score on recompute, never decreases it on its own). Entities/VOs: ScoreComponent, ScoringWeights (per-tenant configurable), PriorityRecomputeTrigger. Events: `MessagePrioritized`, `MessagePriorityEscalated`.

### Governing ADRs

- [ADR 0009](adr/0009-prioritization-urgency-scoring-model.md) (prioritization/urgency scoring model—the five-signal composite: VIP status, interaction frequency, content-based urgency, calendar proximity, NeedsReply aging; weights versioned and treated as an empirically-retunable hypothesis, not a launch-blocking formula) is the primary/established ADR
- [ADR 0006](adr/0006-multi-label-classification-data-model.md) (multi-label data model, honored—priority_score modeled as a cross-cutting scalar field, not a competing category)
- [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) (safe rollout, honored—scoring-weight changes go through the same shadow-evaluation gate as rule/prompt changes)

### Implementation Prompt

> Implement the [Prioritization](ddd/contexts/prioritization.md) bounded context per its DDD doc. Build the `MessagePriority` aggregate computing a sum-and-clamp 0-100 score from five independently-bounded `ScoreComponent`s per [ADR 0009](adr/0009-prioritization-urgency-scoring-model.md): VIP status (from Stage 5's `ContactPromotedToVip`), interaction frequency (from Stage 5's `InteractionFrequencyUpdated`), content-based urgency (deadline/keyword detection escalating to LLM judgment via Stage 4's shared `ClassifierPort`, not a second bespoke LLM integration), calendar proximity (derived from signals already normalized into `MessageEnvelope` by Stage 3's Mailbox Ingestion—no fresh Calendar API call), and NeedsReply aging (from Stage 4's `MessageClassified`, monotonically increasing the score on recompute, never decreasing except via answering or explicit correction). Maintain a `PriorityInputsReadModel` as an eventually-consistent projection built from `MessageClassified`/`SenderClassified`/`ContactPromotedToVip` events so scoring never synchronously calls out to Classification or Contact Graph. Make `ScoringWeights` a first-class, per-tenant-configurable value (ship sane default weights, since research flags the 4-signal-0-100 formula as one plausible pattern, not a proven standard)—every weight change must pass through the same shadow-evaluation gate from Stage 4 ([ADR 0018](adr/0018-deployment-cicd-safe-rollout.md)) before promotion, and new tenants default to a conservative scoring band until enough sender/content history accumulates. Publish `MessagePrioritized` on every recompute and the narrower `MessagePriorityEscalated` specifically on an upward tier crossing. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), an idempotency test confirms identical inputs always reproduce the identical score on replay; a shadow-eval run scores a candidate weight change against labeled ground-truth urgency rankings in the golden dataset before it can promote; the API/UI-facing score-explanation surface (per-signal contribution breakdown) is unit-tested to sum to the total score.

---

## Stage 8 — Mailbox Write-back / Sync

### Goal

Build the `MessageWriteBackState` aggregate that fans in the four independent upstream facet streams (Classification, Threat Detection, Contact Graph, Prioritization) and idempotently applies them to the tenant's actual Gmail labels / Outlook categories-and-folder-and-importance.

### Why This Stage Now

This is a pure fan-in consumer of all four verdict-producing contexts (Stages 4-7)—per [context-map.md](ddd/context-map.md)'s relationship table, it is Customer/Supplier to each of `MessageClassified`, `MessageThreatAssessed`, `SenderClassified`, and `MessagePrioritized` independently, and literally cannot be built until all four exist to compose. This is also where the product's core promise—mail actually gets sorted in the user's real mailbox—is delivered; every prior stage is decision-making, this stage is the first one with a user-visible side effect.

### Bounded Context(s) in Scope

[Mailbox Write-back / Sync](ddd/contexts/mailbox-writeback.md). Aggregate: `MessageWriteBackState` (identity: (TenantId, MailboxId, MessageId); tracks last-applied value and platform-write status per facet type independently—a failure/delay in one facet never blocks another; apply operations are idempotent-by-construction, comparing desired state against `lastKnownPlatformState` before any API call; a Quarantine decision from Threat Detection takes precedence, suppressing other facets' visible application per tenant policy; detecting a Divergence never destructively mutates this aggregate's own state, only raises the event and defers interpretation to Feedback & Learning). Entities/VOs: FacetApplication, PlatformApplicationStrategy (per-tenant config), WriteBackFailureReason. Events: `FacetAppliedToPlatform`, `WriteBackFailed`, `WriteBackDivergenceDetected`.

### Governing ADRs

- [ADR 0003](adr/0003-platform-normalization-layer.md) (platform normalization/ACL, honored—this is where its write-back-direction translation is actually implemented: Gmail `labels.modify` additive-only/never-fights-native-tabs, Outlook `message.categories` additive plus optional folder move and `importance`)
- [ADR 0006](adr/0006-multi-label-classification-data-model.md) (multi-label data model, honored—this is where the Gmail-additive-labels vs. Outlook-single-folder-plus-categories asymmetry gets explicitly resolved: folder = highest-confidence/highest-priority label, categories array = full label set)
- [ADR 0017](adr/0017-scalability-queueing-autoscaling.md) (scalability, honored—per-platform rate-limit/backoff behind the same `MailboxWritePort` signature)
- [ADR 0016](adr/0016-observability-slas-alerting.md) (SLA, honored—facet-level independent latency, quarantine-precedence-over-normal-labeling)

### Implementation Prompt

> Implement the [Mailbox Write-back / Sync](ddd/contexts/mailbox-writeback.md) bounded context per its DDD doc. Build the `MessageWriteBackState` aggregate tracking `FacetApplication` independently per facet type (Category from Stage 4, Threat from Stage 6, Contact from Stage 5, Priority from Stage 7)—a slow or failing write for one facet must never block another; implement idempotent-apply by comparing desired state (from the upstream event) against `lastKnownPlatformState` before issuing any platform call, per [ADR 0003](adr/0003-platform-normalization-layer.md)/[ADR 0006](adr/0006-multi-label-classification-data-model.md). Build `GmailWriteBackAdapter` and `OutlookWriteBackAdapter` implementing one `MailboxWritePort.applyFacet(mailboxId, messageId, facet, desiredValue)`, following the exact translation table in [mailbox-writeback.md](ddd/contexts/mailbox-writeback.md): Gmail adds labels additively, never removing/overriding Gmail's own CATEGORY_* system labels; Outlook adds to `categories[]` and, per `PlatformApplicationStrategy` (a per-tenant config value—folder moves are more disruptive than additive categories, make this explicit tenant-level UX choice configurable), optionally moves to a mapped folder; PriorityTier additionally sets Outlook's native `importance` property (Gmail has no equivalent, label-only there). Enforce the Quarantine-takes-precedence invariant: while a Threat Detection Quarantine is active for a message, other facets may still be recorded internally but their platform-visible application is suppressed per tenant policy, so a quarantined message never simultaneously appears in a normal-looking label/folder. Implement per-platform rate-limit/backoff (Gmail 250 units/user/sec, Outlook 10k req/10min + Retry-After) behind the shared port signature, and a durable, retryable `WriteBackTaskQueue` per facet application. On a subsequent Mailbox Ingestion sync (Stage 3) showing platform state diverges from what was last applied, raise `WriteBackDivergenceDetected` without attempting to interpret it—that's Stage 9's job. Meter `FacetAppliedToPlatform` volume back to Stage 1's UsageMeter per [ADR 0021](adr/0021-usage-metering-billing.md). Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), an integration test against mocked Gmail/Graph write endpoints confirms a repeated apply of the same facet produces zero duplicate labels/categories and no observable extra API call (true idempotency); a test confirms a Locked quarantine suppresses a concurrently-arriving normal-priority label's visible application; an E2E test runs a message through ingestion→classification→write-back and asserts the correct Gmail label / Outlook category+folder+importance state.

---

## Stage 9 — Feedback & Learning

### Goal

Build `CorrectionRecord` and `SenderReputationCache` aggregates that turn observed and explicit user corrections into few-shot refreshes, reputation-cache updates, and taxonomy-version-bump triggers, closing the loop back into Classification and Contact Graph.

### Why This Stage Now

Downstream of [Mailbox Write-back](ddd/contexts/mailbox-writeback.md) (Stage 8)—`WriteBackDivergenceDetected` on a subsequent sync is the primary passive-correction signal, so there is nothing to observe until write-back exists—and downstream of [Threat Detection](ddd/contexts/threat-detection.md)'s `QuarantineOverridden` (Stage 6). Upstream of Classification and Contact Graph (publishes `FewShotExampleSetUpdated`, `SenderReputationUpdated`, `ContactSignalReinforced` back into them), so it necessarily comes after the contexts it will later improve, closing the loop rather than opening it.

### Bounded Context(s) in Scope

[Feedback & Learning](ddd/contexts/feedback-learning.md). Aggregates: `CorrectionRecord` (identity: internally minted CorrectionId referencing (TenantId, MessageId); captures both original and corrected verdict plus originating context; PassiveInferred corrections are quarantined in a `Candidate` state and DO NOT affect reputation/few-shot until corroborated by a repeated pattern or explicitly confirmed; ExplicitUserAction/AdminOverride are trusted immediately; reversing a Locked Threat Detection quarantine requires AdminOverride specifically, an ordinary correction cannot), `SenderReputationCache` (identity: (TenantId, SenderDomain); rolling confidence-weighted history, only updated by trusted corrections and high-confidence outcomes over time, never a single low-confidence signal; consulted-not-authoritative—a contradicting CorrectionRecord always wins over the cached prior for that specific message). Events: `UserCorrectionObserved`, `FewShotExampleSetUpdated`, `SenderReputationUpdated`, `ContactSignalReinforced`, `TaxonomyVersionBumpTriggered`.

### Governing ADRs

- [ADR 0014](adr/0014-feedback-loop-continuous-learning.md) (feedback loop & continuous learning—the hybrid passive/explicit capture model, aggregation-before-promotion for passive signals, tenant-scoped-by-default learning boundary with a narrow, corroboration-gated path to global promotion) is the primary/established ADR
- [ADR 0013](adr/0013-data-retention-encryption-privacy.md) (privacy, honored—redaction/minimization of message-excerpt text before it can be persisted into a prompt-bound few-shot set)
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored—the per-tenant-vs-global learning boundary is enforced through the same RLS mechanism from Stage 0, with global-watchlist-style promotion as a separate, explicit, audited operation, never an RLS bypass)
- [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) (safe rollout, honored—every few-shot-set/reputation-cache update rolls out through the same shadow-evaluation gate established in Stage 4 before it can affect live classification, never applied live and unreviewed)

### Implementation Prompt

> Implement the [Feedback & Learning](ddd/contexts/feedback-learning.md) bounded context per its DDD doc. Build the `CorrectionRecord` aggregate capturing `VerdictSnapshot` (originating context tagged as Classification|Prioritization|ThreatDetection|ContactGraph—corrections route back only to their originating context's published language, never applied cross-context by guesswork), with `CorrectionSource` (PassiveInferred|ExplicitUserAction|AdminOverride) carrying different trust weights per [ADR 0014](adr/0014-feedback-loop-continuous-learning.md): consume `WriteBackDivergenceDetected` from Stage 8 as the passive signal, quarantining it in a `Candidate` state that does NOT touch `SenderReputationCache` or few-shot pools until either corroborated by a repeated pattern from the same tenant/sender or explicitly confirmed via a dedicated 'this was miscategorized' API action (Stage 11); consume `QuarantineOverridden` from Stage 6 as a distinct AdminOverride-only correction type, since reversing a Locked quarantine requires admin action specifically, never an ordinary user correction alone. Build the `SenderReputationCache` aggregate ((TenantId, SenderDomain)-keyed, rolling confidence-weighted category history) consumed by Stage 4's Rule tier as a confidence-raising prior—but any specific contradicting `CorrectionRecord` always wins over the cached prior for that message. Implement few-shot example curation: confirmed corrections (explicit, or corroborated-passive) become candidate few-shot examples, filtered for single-label/unambiguous framing per research's ~5-examples-per-category guidance, with message-excerpt text redacted/truncated to the minimal demonstrative span before persistence, per [ADR 0013](adr/0013-data-retention-encryption-privacy.md). Enforce the tenant-scoped-by-default learning boundary via the same RLS mechanism as every other table ([ADR 0015](adr/0015-multi-tenancy-data-isolation.md)); implement promotion-to-global (e.g., the shared brand-watchlist-adjacent bulk-sender seed list) as a separate, explicit, audited operation requiring corroboration across multiple tenants and containing no tenant-identifying content—never a default data flow. Publish `FewShotExampleSetUpdated`, `SenderReputationUpdated` (consumed by Stage 4), `ContactSignalReinforced` (consumed by Stage 5), and `TaxonomyVersionBumpTriggered` (triggers Stage 4's `MessageReclassified` backfill wave). Route every one of these updates through Stage 4's shadow-evaluation gate before it can affect live classification, per [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md). Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), a test confirms a single passive correction alone never updates SenderReputationCache or few-shot examples, only a corroborated pattern or explicit/admin action does; a test confirms a CorrectionRecord attempting to reverse a Locked quarantine is rejected unless tagged AdminOverride; a shadow-eval run demonstrates a proposed few-shot-set update is scored against the golden dataset before promotion.

---

## Stage 10 — Notification & Alerting

### Goal

Build `NotificationSubscription` and `AlertDispatch` aggregates rendering upstream verdicts into digests and rate-limited, channel-appropriate interruptive alerts.

### Why This Stage Now

A pure downstream fan-in renderer over Threat Detection (Stage 6), Classification (Stage 4), Prioritization (Stage 7), [Identity & Access](ddd/contexts/identity-access.md) (Stage 2, for authorized notification channels), and [Tenant & Subscription](ddd/contexts/tenant-subscription.md) (Stage 1, for digest-frequency entitlement)—every one of its upstream dependencies already exists by this point. Deliberately sequenced last among the domain contexts: it adds no classification/scoring/threat logic of its own, and its absence does not block the core triage value already delivered by Stage 8—it only affects how that already-decided value is surfaced to the user.

### Bounded Context(s) in Scope

[Notification & Alerting](ddd/contexts/notification-alerting.md). Aggregates: `NotificationSubscription` (identity: (TenantId, UserId); every alert-eligible event type has an explicit per-user NotificationPreference, fresh subscriptions start with safe non-spammy defaults—phishing alerts on, everything else digest-only; a channel can only be used if [Identity & Access](ddd/contexts/identity-access.md) reports it authorized), `AlertDispatch` (identity: internally minted AlertId; rate-limited per user per triggering category within a cool-down window to prevent alert storms; once Dispatched, immutable—a later correction produces a distinct follow-up notification, never a mutation). Entities/VOs: NotificationPreference, DigestWindow, AlertPayload. Events: `AlertDispatched`, `DigestGenerated`, `NotificationDeliveryFailed`.

### Governing ADRs

- [ADR 0016](adr/0016-observability-slas-alerting.md) (observability/SLAs, honored as this stage's primary application—`NeedsReplyAgingThresholdCrossed`-style escalation logic computed here from `MessageClassified` timestamps against a configurable EscalationThreshold, and the ≤2min time-critical alert-worthy events from Stage 3/6/7 are what this stage's Alert path exists to surface promptly)
- [ADR 0021](adr/0021-usage-metering-billing.md) (usage metering, honored—alert/digest volume as a billable, plan-limited dimension fed back to Stage 1's UsageMeter)

### Implementation Prompt

> Implement the [Notification & Alerting](ddd/contexts/notification-alerting.md) bounded context per its DDD doc. Build `NotificationSubscription` with explicit per-event-type `NotificationPreference` entries (Immediate|DigestOnly|Off, per preferredChannel)—no implicit notify-by-default state; fresh subscriptions default to phishing alerts Immediate, everything else DigestOnly. Enforce that a channel can only be used if [Identity & Access](ddd/contexts/identity-access.md) (Stage 2) reports it authorized for that user—never send to an unverified channel even if a preference nominally selects it. Build `AlertDispatch`, consuming `MessageQuarantined` (Stage 6, highest-severity trigger), `MessagePriorityEscalated` (Stage 7), and a `NeedsReplyAgingThresholdCrossed` signal computed here (not upstream) from Stage 4's `MessageClassified` timestamps against a per-tenant-configurable `EscalationThreshold`, consistent with the ≤2min time-critical SLA established in Stage 3/[ADR 0016](adr/0016-observability-slas-alerting.md)—Classification itself has no notion of 'how long has this sat unanswered,' so that aging logic belongs here. Rate-limit dispatch per user per triggering category within a cool-down window to prevent alert storms from a burst of related upstream events; make Dispatched alerts immutable, with a correction (e.g., QuarantineOverridden) producing a distinct follow-up notification rather than mutating the original. Build `NotificationDeliveryAdapter` behind one `NotificationDeliveryPort(send(channel, payload))` for push/SMS/in-app/digest-email, routing digest email through a transactional-email path entirely separate from the tenant's own triaged mailbox—never notify about email congestion by adding to it. Implement scheduled digest generation (idempotent per (TenantId, UserId, digest window), cadence from Stage 1's `Entitlement.DigestFrequency`). Publish `AlertDispatched`/`DigestGenerated` to Stage 1's UsageMeter per [ADR 0021](adr/0021-usage-metering-billing.md). Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), a test confirms a burst of 5 near-simultaneous MessagePriorityEscalated events for the same sender within the cool-down window produces exactly one alert, not five; an E2E test confirms a message reaching MessageQuarantined during Stage 6/8 flow produces an alert within the ≤2min time-critical SLA target from Stage 3/[ADR 0016](adr/0016-observability-slas-alerting.md).

---

## Stage 11 — Public/Internal API & Client Surface

### Goal

Build the single, versioned, authenticated REST API (`/v1/...`) exposing the complete resource model—messages with full multi-facet classification, corrections, mailbox connections, tenant config, usage/billing—to both the first-party web UI and third-party integrations.

### Why This Stage Now

Can only be meaningfully designed once the full resource model is stable—messages carrying all four independently-published facets (Stages 4-7), corrections (Stage 9), mailbox connection lifecycle (Stage 2), and usage/billing state (Stage 1) all need to exist first, since [ADR 0020](adr/0020-public-internal-api-design.md) explicitly ties the API's core resource model to exactly these prior stages' outputs. This is also where Stage 9's "explicit correction" UI action and Stage 7's score-explanation surface get their first real endpoint.

### Bounded Context(s) in Scope

Spans all 10 bounded contexts as a read/write API layer above them—not itself a bounded context; no new aggregates, only endpoints translating HTTP requests into commands/queries against the aggregates built in Stages 1-10.

### Governing ADRs

- [ADR 0020](adr/0020-public-internal-api-design.md) (public/internal API design) is the primary/established ADR—one shared REST contract for first-party UI and third-party integrations, tenant-scoped API keys or OAuth sessions, outbound webhooks explicitly treated with the same "no guaranteed delivery, poll as backstop" caveat the system itself learned from Gmail/Graph, rate limits tied to plan tier
- [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) (tenancy, honored—API-layer tenant-scoping as a second, defense-in-depth enforcement point alongside database RLS, since an API-layer bug must not be the only thing standing between a request and another tenant's data)

### Implementation Prompt

> Implement the versioned `/v1` REST API per [ADR 0020](adr/0020-public-internal-api-design.md), exposing exactly the core resource model it specifies: messages (multi-label classification per Stage 4, priority score with per-signal breakdown per Stage 7, phishing status per Stage 6), mailbox connections (OAuth lifecycle per Stage 2), tenant configuration (VIP lists surfaced from Stage 5, category rule overrides, budget settings from Stage 1/4), corrections/feedback (the explicit 'this was miscategorized' action Stage 9's CorrectionRecord depends on for its high-trust path), and usage/billing (Stage 1). Authenticate first-party UI sessions and third-party integration access through the same contract—tenant-scoped API keys or OAuth sessions—with no separate internal-only shortcut API. Implement API-layer tenant-scoping middleware as a second enforcement point independent of, and in addition to, the database RLS from Stage 0—write an adversarial test that attempts to bypass API-layer scoping and confirms RLS still blocks the cross-tenant read even if the API layer had a bug. Implement outbound webhook subscriptions ('message classified,' 'phishing quarantined,' 'SLA-relevant category detected') explicitly documented as a latency optimization, not a delivery guarantee, with the REST API remaining the authoritative poll-able source of truth for any integration that cannot tolerate a missed event—mirroring the lesson the system itself learned building against Gmail/Graph's own non-guaranteed webhooks in Stage 3. Tie API rate limits to the tenant's plan tier from Stage 1, independent of the internal Gmail/Graph-outbound rate limiting from Stage 3/[ADR 0017](adr/0017-scalability-queueing-autoscaling.md). Version the API from day one (`/v1`) with a documented deprecation window for any future breaking change. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), an E2E test drives a full first-party-UI-shaped flow (connect mailbox → see classified/prioritized/threat-flagged messages → submit an explicit correction → see usage/billing state) entirely through this API; the adversarial cross-tenant API test above passes; API documentation is published covering every endpoint in the core resource model.

---

## Stage 12 — Deployment Hardening, Safe-Rollout Completion & Disaster Recovery

### Goal

Finalize deployment topology (managed container orchestration, isolated-instance option for enterprise tenants), complete the canary-rollout operational mechanics, and establish RPO/RTO targets, regional failover, graceful degradation, and tested restore drills.

### Why This Stage Now

This is the final operational-readiness gate, deliberately last because its content presupposes nearly everything else already exists: graceful degradation specifically means 'LLM provider outage falls back to Tier-1-rules-only classification' (Stage 4's tiered pipeline must exist), sync-cursor resilience presupposes Stage 3's delta-sync cursor model, and the 'no native-platform fallback' risk being mitigated here is a direct consequence of Stage 4/[ADR 0008](adr/0008-rule-engine-ownership.md)'s decision to keep rules centrally authoritative rather than delegating to native engines. This stage is the general-availability gate, not a feature stage.

### Bounded Context(s) in Scope

None directly—deployment/operational infrastructure layer above all 10 contexts, closing out the CI/CD and safe-rollout work partially established in Stage 0 (CI gates) and Stage 4 (shadow-evaluation).

### Governing ADRs

- [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) (deployment topology, CI/CD & safe rollout strategy) is completed here—the actual deployment topology (containerized services on managed orchestration, shared-schema default per Stage 0/[ADR 0015](adr/0015-multi-tenancy-data-isolation.md), isolated-instance option for enterprise contractual requirements) and the full canary-rollout operational mechanics (opt-in beta tenants first, then a random low-percentage slice, monitored against Stage 3's SLIs, versioned rollback as a pointer change tied to `pipeline_version`) are built out fully here, on top of the CI gates from Stage 0 and the shadow-evaluation gate from Stage 4
- [ADR 0019](adr/0019-disaster-recovery-business-continuity.md) (disaster recovery & business continuity) is the other primary/established ADR: RPO ≤5min / RTO ≤1hr targets, encrypted point-in-time-recoverable backups with tested (not assumed) restore drills, sync-cursor and webhook-subscription state treated as tenant-critical per Stage 3, secrets-store replication (Stage 2) included in the failover plan, and graceful degradation (LLM outage → Tier-1-only, per Stage 4, rather than full pipeline halt)

### Implementation Prompt

> Finalize deployment and DR posture per [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) and [ADR 0019](adr/0019-disaster-recovery-business-continuity.md). Deploy the containerized services (API and per-queue workers from Stage 3/[ADR 0017](adr/0017-scalability-queueing-autoscaling.md)) to a managed container orchestration platform with the shared-schema multi-tenant model (Stage 0/[ADR 0015](adr/0015-multi-tenancy-data-isolation.md)) as default and a documented isolated-instance deployment option for enterprise tenants with contractual data-residency/isolation requirements. Complete the canary-rollout mechanics building on Stage 4's shadow-evaluation gate: promote a classification-affecting change first to opt-in beta tenants, then a random low-percentage slice, monitored specifically against the SLIs established in Stage 3/[ADR 0016](adr/0016-observability-slas-alerting.md) for that canary cohort before full promotion; implement rollback as a `pipeline_version` pointer change (not a code revert), with prior versions retained for a defined window. Set explicit RPO ≤5min / RTO ≤1hr targets per [ADR 0019](adr/0019-disaster-recovery-business-continuity.md): configure continuous Postgres replication and point-in-time-recoverable encrypted backups covering tenant-critical state (OAuth token references, Stage 3's delta-sync cursors and webhook-subscription state, classification history, billing/usage state)—schedule and execute periodic restore drills that actually restore a backup and verify it, not merely confirm the backup job ran. Configure regional failover for database and compute, including replication of the Stage 2 secrets store (tokens are required to resume ingestion/write-back after failover). Implement graceful degradation: on sustained Anthropic API outage, Stage 4's pipeline falls back to Tier-1-rules-only classification (lower coverage, not zero) rather than halting; on single-region outage, trigger failover rather than a full stop. Wire sustained SLA breach (per Stage 3/10's thresholds) to trigger tenant-facing status communication. Done = per [ADR 0022](adr/0022-testing-and-evaluation-strategy.md), a scheduled restore drill in a non-production environment successfully restores from backup within the RTO target and is documented as evidence (not merely scheduled); a chaos test that kills the Anthropic API connection confirms the pipeline degrades to Tier-1-only classification rather than halting; a canary promotion of a deliberately-flawed test change is caught by cohort-specific SLI monitoring before full rollout.

---

## Coverage Verification

This implementation plan comprehensively covers all 22 Architecture Decision Records and all 10 Domain-Driven-Design bounded contexts from the research report and repo documentation:

### All 22 ADRs Cited Exactly Once as Primary/Established:

| ADR | Stage | Reference |
|-----|-------|-----------|
| [ADR 0001](adr/0001-server-side-middleware-saas-architecture.md) | 0 | umbrella architectural decision |
| [ADR 0002](adr/0002-technology-stack-selection.md) | 0 | technology stack foundation |
| [ADR 0003](adr/0003-platform-normalization-layer.md) | 3 | platform normalization (honored Stage 8) |
| [ADR 0004](adr/0004-real-time-ingestion-with-delta-sync-backstop.md) | 3 | dual-path sync |
| [ADR 0005](adr/0005-tiered-classification-pipeline.md) | 4 | tier ordering and routing |
| [ADR 0006](adr/0006-multi-label-classification-data-model.md) | 4 | normalized label storage (honored Stages 7-8) |
| [ADR 0007](adr/0007-llm-provider-model-tiering-cost-governance.md) | 4 | LLM provider/tier selection (honored Stage 6) |
| [ADR 0008](adr/0008-rule-engine-ownership.md) | 4 | centralized rule authority |
| [ADR 0009](adr/0009-prioritization-urgency-scoring-model.md) | 7 | five-signal composite scoring |
| [ADR 0010](adr/0010-phishing-detection-layering-and-incident-response.md) | 6 | three-layer threat detection |
| [ADR 0011](adr/0011-personal-contact-relationship-graph-heuristics.md) | 5 | weighted contact scoring |
| [ADR 0012](adr/0012-oauth-token-lifecycle-secrets.md) | 2 | OAuth scope/token management (honored Stages 3, 12) |
| [ADR 0013](adr/0013-data-retention-encryption-privacy.md) | 2/3 | privacy/retention/encryption (honored Stages 5, 9) |
| [ADR 0014](adr/0014-feedback-loop-continuous-learning.md) | 9 | passive/explicit correction & learning |
| [ADR 0015](adr/0015-multi-tenancy-data-isolation.md) | 0 | RLS-by-default tenancy (honored throughout) |
| [ADR 0016](adr/0016-observability-slas-alerting.md) | 0 | SLI scaffolding (expanded Stages 3, 6, 8, 10) |
| [ADR 0017](adr/0017-scalability-queueing-autoscaling.md) | 0 | queue skeleton (expanded Stages 3, 4, 8) |
| [ADR 0018](adr/0018-deployment-cicd-safe-rollout.md) | 0 | CI gates (expanded Stages 4, 7, 9, 12) |
| [ADR 0019](adr/0019-disaster-recovery-business-continuity.md) | 12 | RPO/RTO, failover, restoration |
| [ADR 0020](adr/0020-public-internal-api-design.md) | 11 | versioned REST API contract |
| [ADR 0021](adr/0021-usage-metering-billing.md) | 1 | metering/billing (honored Stages 3, 4, 8, 10) |
| [ADR 0022](adr/0022-testing-and-evaluation-strategy.md) | 0 | test pyramid & eval harness (expanded Stages 4, 6, throughout) |

### All 10 DDD Bounded Contexts Cited as Primary Stage Scope:

| Context | Stage | Document |
|---------|-------|----------|
| [Tenant & Subscription](ddd/contexts/tenant-subscription.md) | 1 | Commercial root context |
| [Identity & Access](ddd/contexts/identity-access.md) | 2 | OAuth/credential management |
| [Mailbox Ingestion](ddd/contexts/mailbox-ingestion.md) | 3 | Dual-path sync engine |
| [Classification](ddd/contexts/classification.md) | 4 | Tiered triage pipeline |
| [Contact Graph](ddd/contexts/contact-graph.md) | 5 | Personal/VIP scoring |
| [Threat Detection](ddd/contexts/threat-detection.md) | 6 | Phishing/BEC detection |
| [Prioritization](ddd/contexts/prioritization.md) | 7 | Urgency scoring |
| [Mailbox Write-back / Sync](ddd/contexts/mailbox-writeback.md) | 8 | Platform application layer |
| [Feedback & Learning](ddd/contexts/feedback-learning.md) | 9 | Correction & loop closure |
| [Notification & Alerting](ddd/contexts/notification-alerting.md) | 10 | User-facing notifications |

All stages are sequenced according to their upstream/downstream dependencies as mapped in [context-map.md](ddd/context-map.md), with no stage built before its prerequisites exist.
