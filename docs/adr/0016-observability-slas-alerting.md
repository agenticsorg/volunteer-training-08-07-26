# 0016. Observability, SLAs & alerting

## Status
Accepted

## Date
2026-08-07

## Context
The research flags explicit-latency SLA setting as an open decision (research §6, open decision #4): "these are the two categories where staleness has real user cost (missed deadline, showing up to a cancelled meeting) — worth explicitly deciding a max-latency target (e.g., <2 min) that shapes whether you can rely on webhook-triggered pushes alone or need tighter polling as backstop," referring specifically to **needs-a-reply** and **meeting-cancellation**. The research's own dual-path ingestion design (research §5.2, and [[0004-real-time-ingestion-with-delta-sync-backstop]]) is explicitly latency-shaped by whatever SLA is chosen here — the reconciliation interval, webhook renewal aggressiveness, and urgent-path LLM routing (see [[0007-llm-provider-model-tiering-cost-governance]]) all derive from it.

## Decision
We set explicit, tiered latency SLAs, resolving research §6 open decision #4:

- **Time-critical categories** (needs-a-reply candidates, meeting cancellations, high-confidence phishing): **target end-to-end latency (message arrival → classification + write-back complete) of ≤2 minutes at p95**, achieved via the webhook push path plus urgent-path interactive LLM calls (not batch) from [[0004-real-time-ingestion-with-delta-sync-backstop]] and [[0007-llm-provider-model-tiering-cost-governance]]. This directly bounds the reconciliation-sweep interval design (default 5 minutes, per [[0004-real-time-ingestion-with-delta-sync-backstop]]) as a backstop *ceiling*, not the primary latency mechanism — the push path must carry the ≤2 min target in the common case.
- **Standard categories** (newsletters, e-commerce, social, LinkedIn, sales/deals, personal contacts, general prioritization): **target ≤15 minutes at p95**, allowing batch-path LLM confirmation (per [[0007-llm-provider-model-tiering-cost-governance]]) and less aggressive routing.
- **SLA is a plan-tier-configurable ceiling** (see [[0021-usage-metering-billing]]): higher plan tiers may receive tighter reconciliation intervals and priority queue placement; the ≤2 min time-critical target is the floor guarantee across all paid tiers, not just the top tier, since correctness for meeting-cancellation/needs-reply is a trust-critical product promise, not a premium upsell.
- **Monitored SLIs**: end-to-end ingestion-to-write-back latency (per category-criticality bucket, per tenant and aggregate), webhook-subscription health (active/expired/renewal-failed count per platform), delta-sync lag (time since last successful reconciliation per mailbox), classification-tier distribution (% resolved at Tier 1/2/3, tracking cost-model assumptions from [[0007-llm-provider-model-tiering-cost-governance]]), and LLM error/timeout rate per tier.
- **Alerting**: paged on-call alerts for (a) webhook subscription renewal failure (silent degradation to reconciliation-only latency, per [[0004-real-time-ingestion-with-delta-sync-backstop]]), (b) time-critical SLA breach sustained beyond a defined burn-rate threshold, (c) per-tenant LLM budget-ceiling degradation events (see [[0007-llm-provider-model-tiering-cost-governance]]), (d) RLS/tenant-isolation anomalies (see [[0015-multi-tenancy-data-isolation]]). Non-paged dashboards cover standard-category SLA trends, cost/tier-distribution trends, and per-category precision/recall drift (feeding [[0022-testing-and-evaluation-strategy]]).

## Consequences

### Positive
- Directly resolves the research's open SLA question with concrete, testable numbers that shape every latency-sensitive design decision elsewhere in the system, rather than leaving "how fast is fast enough" implicit and inconsistently applied.
- Tiered SLA (time-critical vs. standard) lets us keep the cost advantage of batch/reconciliation-path processing for the majority of low-stakes volume while still meeting the specific cases the research identifies as having real user cost.
- Concrete SLIs give the engineering team an objective, monitorable definition of "the system is working," not just "no exceptions in the logs."

### Negative
- Meeting the ≤2 min time-critical target requires classifying whether a message is time-critical (needs-a-reply candidate, meeting-related, phishing-adjacent) *before* full classification completes, since full classification is what the SLA is timing — this requires a fast pre-triage signal (structural: thread-state, `METHOD:CANCEL`, sender/auth-failure signals — all Tier 1, per [[0005-tiered-classification-pipeline]]) to route a message onto the urgent path early, adding a small amount of pipeline complexity.
- Paged on-call alerting is an ongoing operational cost (rotation, tooling, response process) that a lower-commitment product might defer.

### Risks
- SLA commitments become contractual/reputational promises once published to tenants (see [[0021-usage-metering-billing]] plan terms) — breaching them repeatedly has business consequences beyond the technical fix, so the alerting thresholds must be conservative enough to catch degradation before tenants notice, not merely after a full breach.

## Alternatives Considered
- **Single uniform SLA for all categories** — rejected: research §6 explicitly distinguishes time-critical categories from the rest by real user cost; a uniform target would either over-invest in low-stakes categories (unnecessary interactive-LLM cost) or under-serve the genuinely time-sensitive ones.
- **No formal SLA, best-effort only** — rejected: leaves the reconciliation-interval, urgent-path-routing, and alerting-threshold decisions with no objective anchor, and is incompatible with the commercial, contractually-facing nature of the product (see [[0021-usage-metering-billing]]).

## Related ADRs
[[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]], [[0007-llm-provider-model-tiering-cost-governance]], [[0010-phishing-detection-layering-and-incident-response]], [[0015-multi-tenancy-data-isolation]], [[0021-usage-metering-billing]], [[0022-testing-and-evaluation-strategy]]
