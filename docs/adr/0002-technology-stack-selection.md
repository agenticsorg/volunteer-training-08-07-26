# 0002. Technology stack selection

## Status
Accepted

## Date
2026-08-07

## Context
The research does not prescribe a specific implementation stack; it establishes architectural requirements the stack must satisfy: a continuously-running server-side service (research §5.1) that performs OAuth token management, webhook ingestion + delta-sync reconciliation for two platforms (research §5.2), a multi-stage classification pipeline with LLM calls including Anthropic's Batch API (research §2.3), and per-tenant state (VIP lists, sender-reputation cache, correction history — research §5.3). It must also meet enterprise SaaS expectations: strong typing for a large, multi-team codebase, mature OAuth libraries for both Google and Microsoft identity platforms, a queueing system that can express delayed/retryable jobs (webhook debounce, delta-sync sweeps, LLM batch polling), and a relational store capable of enforcing per-tenant row-level isolation (see [[0015-multi-tenancy-data-isolation]]).

## Decision
- **Language/runtime**: TypeScript on Node.js (LTS) for all backend services. Rationale: first-class official SDKs for both Google APIs (`googleapis`, `google-auth-library`) and Microsoft Graph (`@azure/msal-node`, `@microsoft/microsoft-graph-client`); official Anthropic TypeScript SDK; strong typing reduces integration-surface bugs when normalizing two divergent platform models (see [[0003-platform-normalization-layer]]); one language across API, workers, and (if built) the web UI reduces team context-switching cost.
- **API framework**: NestJS. Rationale: opinionated module/DI structure scales better across many engineers than an unopinionated framework (Express alone); built-in support for guards/interceptors maps cleanly onto per-tenant auth and rate-limiting concerns (see [[0012-oauth-token-lifecycle-secrets]], [[0021-usage-metering-billing]]).
- **Primary database**: PostgreSQL. Rationale: mature row-level security (RLS) support directly enables the shared-schema tenant-isolation model (see [[0015-multi-tenancy-data-isolation]]); JSONB columns accommodate the multi-label classification model's variable label/confidence structure (see [[0006-multi-label-classification-data-model]]) without an early rigid schema; strong transactional guarantees for token and billing state.
- **Cache / ephemeral state**: Redis. Rationale: backs the queue (below), the sender-reputation cache (research §5.3), and short-lived rate-limit counters for Gmail/Graph API quota management (research §1.1, §1.2).
- **Queue / job broker**: BullMQ (Redis-backed). Rationale: natively expresses delayed jobs (webhook-renewal reminders, delta-sync sweeps), retries with backoff (needed for Graph 429/`Retry-After` handling — research §1.2), and priority queues (urgent-path vs. batch-path separation — research §5.2) without operating a separate broker cluster. Revisit at the scale thresholds defined in [[0017-scalability-queueing-autoscaling]].
- **LLM provider integration**: Anthropic API via the official SDK, using the tiered model/Batch API approach defined in [[0007-llm-provider-model-tiering-cost-governance]].
- **ORM**: Prisma. Rationale: type-safe query layer consistent with the TypeScript-first decision; first-class Postgres RLS interop via raw-SQL escape hatches where needed.

## Consequences

### Positive
- Single-language stack minimizes translation errors between the ingestion, classification, and write-back layers, which must agree on one internal message schema (see [[0003-platform-normalization-layer]]).
- Postgres + RLS gives us tenant isolation "for free" at the database layer, rather than requiring every query to remember a `WHERE tenant_id = ?` clause manually.
- BullMQ/Redis is operationally simple (one Redis cluster) for the expected initial and mid-term scale, deferring the cost/complexity of a dedicated streaming platform.

### Negative
- BullMQ/Redis has lower ceiling throughput and weaker exactly-once/ordering guarantees than a log-based broker (Kafka); this is an explicit, revisitable trade-off (see [[0017-scalability-queueing-autoscaling]]).
- Node.js's single-threaded event loop requires care to avoid blocking on CPU-heavy work (e.g., large-body regex/heuristic scans in Tier 1 — research §2.1); mitigated by keeping Tier 1 rule evaluation cheap and offloading anything heavier to worker processes.

### Risks
- Vendor lock to two large, frequently-changing platform SDKs (`googleapis`, MS Graph SDK) — mitigated by the normalization layer in [[0003-platform-normalization-layer]], which isolates platform-specific SDK usage to thin adapters.

## Alternatives Considered
- **Python (FastAPI)** — strong LLM/data-science ecosystem, but weaker first-party Microsoft Graph tooling and no material advantage over Node for this workload (mostly I/O-bound API orchestration, not model training/inference). Rejected in favor of one stack with better dual-platform OAuth ergonomics.
- **Go** — excellent concurrency and lower resource footprint, but slower iteration speed for a product still defining its taxonomy and prompts, and a smaller pool of mature Anthropic/Google/Microsoft SDKs at the time of writing. Rejected for v1; could be reconsidered for isolated high-throughput services (e.g., the delta-sync worker) if profiling in [[0017-scalability-queueing-autoscaling]] shows Node is the bottleneck.
- **Kafka as the initial broker** — rejected for v1 due to operational overhead disproportionate to initial scale; BullMQ/Redis chosen instead with an explicit revisit trigger in [[0017-scalability-queueing-autoscaling]].
- **MongoDB as primary store** — rejected because tenant-isolation guarantees (RLS) and transactional billing/token state are better served by a relational database; JSONB in Postgres covers the flexible-schema needs the research implies for labels.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0003-platform-normalization-layer]], [[0006-multi-label-classification-data-model]], [[0007-llm-provider-model-tiering-cost-governance]], [[0015-multi-tenancy-data-isolation]], [[0017-scalability-queueing-autoscaling]]
