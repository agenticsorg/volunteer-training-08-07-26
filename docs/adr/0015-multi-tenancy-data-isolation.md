# 0015. Multi-tenancy & data isolation architecture

## Status
Accepted

## Date
2026-08-07

## Context
This is explicitly a commercial multi-tenant SaaS serving many paying tenants concurrently, each connecting their own Gmail and/or Outlook accounts. The research does not directly address multi-tenancy architecture (it is scoped to the classification/integration problem), but its recommendations carry direct isolation implications: per-tenant state includes OAuth tokens, VIP lists, correction history, and sender-reputation caches (research §5.3) — all of which must never leak across tenant boundaries — while a narrow set of *global* data (brand-domain watchlist, common bulk-sender seed list — research §5.3) is intentionally shared. The chosen stack (Postgres, see [[0002-technology-stack-selection]]) supports row-level security (RLS), which is the standard mechanism for enforcing tenant isolation within a shared schema.

## Decision
We adopt **shared-schema-with-tenant-id plus Postgres row-level security (RLS)** as the isolation model, rather than schema-per-tenant or database-per-tenant.

- Every tenant-scoped table carries a `tenant_id` column; RLS policies enforce that a database session can only read/write rows matching the tenant context set for that session (via `SET LOCAL` per request/job, sourced from the authenticated request or job context — never from client-supplied input).
- The API and worker layers set tenant context as the **first operation** in every request/job handler, before any query executes, and this is enforced structurally (a shared middleware/interceptor in the NestJS layer per [[0002-technology-stack-selection]], not a convention every handler must remember).
- **Explicitly global, cross-tenant tables** (brand-domain watchlist, common bulk-sender seed list per research §5.3) are a small, deliberately enumerated exception, clearly separated (distinct schema/namespace) from tenant-scoped tables, and are never queried as a fallback path when tenant context is missing.
- The correction/learning boundary from [[0014-feedback-loop-continuous-learning]] is enforced through this same mechanism: tenant-scoped few-shot examples and reputation-cache entries are RLS-protected; promotion to the global watchlist is a separate, explicit, audited operation — never an RLS bypass.
- OAuth tokens (see [[0012-oauth-token-lifecycle-secrets]]) live in the managed secrets store, keyed by tenant-mailbox id, with access-control enforced at the secrets-store layer as a second, independent isolation boundary beyond database RLS.

## Consequences

### Positive
- Shared-schema-with-RLS gives strong per-query isolation guarantees enforced by the database itself, not solely by application-code discipline — a defense-in-depth property: even a bug that omits an explicit `tenant_id` filter cannot cross tenant boundaries, because RLS enforces it at the database layer.
- Materially lower operational overhead than schema-per-tenant or database-per-tenant at our expected tenant count — one set of migrations, one connection pool, one set of indexes to tune, rather than N schemas/databases to manage and migrate in lockstep.
- Enables efficient cross-tenant *aggregate* operations we legitimately need (e.g., platform-wide cost/usage reporting for [[0021-usage-metering-billing]], global watchlist corroboration for [[0014-feedback-loop-continuous-learning]]) without cross-database queries.

### Negative
- A shared schema means a single Postgres instance/cluster is a larger blast-radius unit than per-tenant databases — a catastrophic failure or a severe RLS misconfiguration bug affects all tenants at once, not one.
- Noisy-neighbor risk: one tenant's unusually high message volume can compete for database resources with others sharing the instance, requiring active resource governance (connection pooling limits, query timeouts) rather than the natural isolation schema-per-tenant would provide.
- RLS correctness is safety-critical and must be tested as such (see [[0022-testing-and-evaluation-strategy]]) — a missing or misconfigured policy on a new table is a silent, severe data-leak bug class, not a functional bug.

### Risks
- Enterprise tenants with strict data-residency or "must be logically or physically separate from other customers" contractual requirements may not accept shared-schema isolation — mitigated by treating dedicated-instance deployment (see [[0018-deployment-cicd-safe-rollout]] deployment topology) as an available *deployment-time* option for such tenants, without changing the core application's data model.
- RLS policy drift (a new table added without a corresponding policy) is the primary ongoing risk — mitigated by a CI check (see [[0018-deployment-cicd-safe-rollout]]) that fails the build if a tenant-scoped table lacks an RLS policy, rather than relying on code review alone.

## Alternatives Considered
- **Schema-per-tenant** — rejected as the default: materially higher migration and operational complexity (N schemas to migrate in lockstep) for an isolation guarantee that RLS already provides at the row level; reconsidered only as a per-tenant override for enterprise contractual requirements, not the baseline architecture.
- **Database-per-tenant** — rejected: the strongest isolation option, but operationally the most expensive (connection management, migrations, backup/restore all multiply by tenant count) and disproportionate to the isolation actually required for the vast majority of tenants; noted as a possible future option for the largest enterprise tenants if contractually required, similar to the schema-per-tenant override.
- **Application-layer-only isolation (no RLS, `tenant_id` filtering by convention in every query)** — rejected: relies entirely on every engineer remembering the filter on every query, with no database-enforced backstop; a single missed filter is a cross-tenant data leak, an unacceptable risk profile for a product handling other people's email.

## Related ADRs
[[0002-technology-stack-selection]], [[0012-oauth-token-lifecycle-secrets]], [[0013-data-retention-encryption-privacy]], [[0014-feedback-loop-continuous-learning]], [[0018-deployment-cicd-safe-rollout]], [[0021-usage-metering-billing]]
