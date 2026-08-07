# 0017. Scalability, queueing & autoscaling architecture

## Status
Accepted

## Date
2026-08-07

## Context
Volume is inherently variable and bursty at multiple levels: per-tenant (a Monday-morning inbox catch-up is very different from steady-state), per-platform-quota (Gmail: 250 quota units/user/sec moving average, 1B units/day project-wide; Graph: ~10,000 req/10 min/app/mailbox, 130,000 req/10 sec across all tenants per app — research §1.1, §1.2), and across tenants as the customer base grows. The chosen queue (BullMQ/Redis, see [[0002-technology-stack-selection]]) must handle this variability, and the pipeline stages (ingestion, Tier 1–3 classification, prioritization, write-back — see [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]]) have very different cost/latency profiles that scale independently.

## Decision
- **Queue topology by criticality and cost**, mirroring the SLA tiers in [[0016-observability-slas-alerting]]: separate BullMQ queues for (a) urgent-path ingestion/classification (time-critical categories, interactive LLM calls), (b) standard-path ingestion/classification (batch-eligible), (c) webhook/subscription-renewal jobs, (d) delta-sync reconciliation sweeps, (e) LLM Batch API polling/collection. Separate queues let each be scaled, prioritized, and rate-limited independently rather than one global FIFO queue where a burst of low-priority mail could delay a time-critical message.
- **Per-platform rate limiting is centralized**, not per-worker: a shared token-bucket limiter (Redis-backed) tracks Gmail and Graph quota consumption per tenant-mailbox and globally per app-level ceiling, so worker autoscaling cannot inadvertently exceed platform quotas (research §1.1, §1.2) regardless of how many worker instances are running.
- **Autoscaling**: API and worker processes scale horizontally based on queue depth and processing latency per queue (not CPU alone, since I/O-bound platform-API calls dominate most stages) — worker pools for the urgent-path queue scale more aggressively/eagerly (favoring the ≤2 min SLA from [[0016-observability-slas-alerting]] over cost efficiency) than standard-path/batch worker pools (favoring cost efficiency, since staleness tolerance is higher).
- **Backpressure, not unbounded queue growth**: each queue has a depth-based alert threshold (see [[0016-observability-slas-alerting]]) and, for the urgent-path queue specifically, a policy of temporarily demoting the least-time-sensitive urgent-path candidates to standard-path under sustained overload, rather than allowing genuinely time-critical latency to degrade uniformly across all messages.
- **Revisit trigger for the broker choice**: BullMQ/Redis (see [[0002-technology-stack-selection]]) is the v1 choice; we set an explicit revisit trigger — sustained throughput approaching Redis single-instance practical ceiling, or a demonstrated need for stronger ordering/replay guarantees than BullMQ provides — as the signal to evaluate a log-based broker (e.g., Kafka) for the highest-volume queues specifically, not necessarily the whole system.

## Consequences

### Positive
- Independent queue scaling means a spike in low-priority newsletter volume cannot starve time-critical needs-reply/meeting-cancellation processing — directly protects the SLA commitments in [[0016-observability-slas-alerting]].
- Centralized rate limiting protects against the single most likely self-inflicted outage mode at scale: worker autoscaling outrunning platform API quotas and triggering sustained 429s across all tenants sharing that quota pool.
- Explicit revisit trigger for the broker avoids two failure modes: prematurely over-engineering with Kafka before it's needed, and silently hitting a scaling wall with no planned response.

### Negative
- Multiple queues and a centralized rate limiter add coordination complexity relative to a single queue — more configuration surface, more places a misconfiguration could cause under- or over-throttling.
- Demoting urgent-path candidates under sustained overload is a deliberate SLA trade-off (some messages get slower processing to protect others) that must be transparent in monitoring, not a silent behavior change.

### Risks
- Gmail's project-wide daily quota (1B units/day) and Graph's global app-level ceiling (130,000 req/10 sec) are shared across *all* tenants using our app-level API credentials — at sufficient scale, a single very-high-volume tenant could approach limits that affect other tenants. Mitigated by per-tenant rate-limit sub-allocation within the global limiter, not just a global ceiling with no per-tenant fairness.

## Alternatives Considered
- **Single shared queue for all message processing** — rejected: cannot express the criticality-based prioritization the SLA tiers in [[0016-observability-slas-alerting]] require without either complex per-job priority scoring (harder to reason about than separate queues) or accepting head-of-line blocking of urgent messages behind bulk volume.
- **Kafka from day one** — rejected for v1 per [[0002-technology-stack-selection]]'s reasoning: operational overhead disproportionate to initial scale; the explicit revisit trigger above preserves the option without paying the cost upfront.
- **Per-worker independent rate limiting (no central limiter)** — rejected: cannot enforce a shared quota ceiling across an autoscaled, dynamically-sized worker pool; would require either very conservative per-worker limits (wasting quota) or risk collectively exceeding the platform ceiling.

## Related ADRs
[[0002-technology-stack-selection]], [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]], [[0016-observability-slas-alerting]], [[0019-disaster-recovery-business-continuity]]
