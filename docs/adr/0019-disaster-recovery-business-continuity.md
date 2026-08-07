# 0019. Disaster recovery & business continuity

## Status
Accepted

## Date
2026-08-07

## Context
Two architectural decisions make disaster recovery unusually important for this product. First, [[0001-server-side-middleware-saas-architecture]] means there is no client-side fallback — if our service is down, no classification or write-back happens at all. Second, [[0008-rule-engine-ownership]] deliberately declines to delegate rule logic to native platform rule engines specifically to preserve auditability and rollout safety, which means the service being down has no native-platform safety net either. Compounding this, [[0004-real-time-ingestion-with-delta-sync-backstop]] establishes that both platforms' webhook subscriptions and delta-sync cursors (`historyId`/delta tokens) are stateful and, per that ADR, losing this state forces an expensive full resync per mailbox.

## Decision
- **Recovery objectives**: Recovery Point Objective (RPO) of ≤5 minutes for tenant-critical state (OAuth token references, delta-sync cursors, classification history, billing/usage state) via continuous Postgres replication and point-in-time-recovery-capable backups; Recovery Time Objective (RTO) of ≤1 hour for full service restoration in a regional-outage scenario.
- **Backup strategy**: automated, encrypted, point-in-time-recoverable database backups (consistent with the encryption-at-rest posture in [[0013-data-retention-encryption-privacy]]); backups are tested via periodic restore drills, not assumed valid — a backup that has never been restored is not a verified backup.
- **Sync-cursor resilience**: delta-sync cursors and webhook-subscription state (see [[0004-real-time-ingestion-with-delta-sync-backstop]]) are treated as tenant-critical state subject to the same RPO, specifically because loss of this state degrades to a full resync per affected mailbox — an operationally expensive and quota-consuming recovery path (see [[0017-scalability-queueing-autoscaling]] on shared platform quota ceilings) that we want to avoid triggering unnecessarily.
- **Regional failover**: the service is deployed with the ability to fail over to a secondary region for the database and compute layers; secrets-store replication (see [[0012-oauth-token-lifecycle-secrets]]) is included in the failover plan since tokens are required to resume ingestion/write-back after failover.
- **Graceful degradation over hard outage**: given no native-platform fallback exists (per [[0008-rule-engine-ownership]]), the service is architected to degrade in stages under partial failure — e.g., LLM provider outage falls back to Tier 1 rules-only classification (lower coverage, not zero coverage, per [[0005-tiered-classification-pipeline]]) rather than the whole pipeline halting; a single-region outage triggers failover rather than a full stop.
- **Incident communication**: sustained SLA breach or outage (per the thresholds in [[0016-observability-slas-alerting]]) triggers tenant-facing status communication, consistent with the SLA being a disclosed commercial commitment (see [[0021-usage-metering-billing]]).

## Consequences

### Positive
- Explicit RPO/RTO targets give the engineering org a concrete bar to design and test against, rather than an implicit assumption that "the cloud provider handles it."
- Treating sync-cursor state as tenant-critical (not just "nice to have") avoids the compounding failure mode where a routine infrastructure incident turns into a mass, quota-expensive resync across many tenants simultaneously.
- Graceful degradation (Tier-1-only fallback on LLM outage) preserves partial product value during a dependency outage instead of an all-or-nothing failure, directly mitigated by the layered pipeline design in [[0005-tiered-classification-pipeline]].

### Negative
- Regional failover and continuous replication carry real infrastructure cost, especially for a secondary region kept warm enough to meet a ≤1 hour RTO.
- Restore-drill testing is an ongoing operational commitment (time, environment cost) that's easy to defer under feature-delivery pressure — must be scheduled and tracked, not left as an aspirational practice.

### Risks
- A prolonged Anthropic API outage degrades classification quality (Tier-1-only) across the entire product simultaneously, since [[0007-llm-provider-model-tiering-cost-governance]] establishes a single-provider dependency — this is an accepted, disclosed risk of that decision, mitigated only by the graceful-degradation behavior here, not eliminated.
- Failover testing itself carries risk (a failover drill that goes wrong could cause the outage it's meant to prevent) — mitigated by running drills against non-production environments first and production drills during defined low-traffic windows with rollback readiness.

## Alternatives Considered
- **No formal DR plan, rely on cloud-provider default durability** — rejected: given [[0001-server-side-middleware-saas-architecture]] and [[0008-rule-engine-ownership]] both eliminate any fallback path, an outage or data-loss event has full, undiluted product impact; commercial SaaS commitments (see [[0021-usage-metering-billing]]) require an explicit, tested plan.
- **Full active-active multi-region deployment from day one** — rejected as premature for v1: materially higher cost and complexity than the RPO/RTO targets above require; active-passive failover meets the stated objectives at lower ongoing cost, with active-active revisitable if scale or contractual SLAs later demand tighter RTO.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]], [[0007-llm-provider-model-tiering-cost-governance]], [[0012-oauth-token-lifecycle-secrets]], [[0013-data-retention-encryption-privacy]], [[0016-observability-slas-alerting]], [[0021-usage-metering-billing]]
