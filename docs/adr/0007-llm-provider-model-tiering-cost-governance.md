# 0007. LLM provider, model tiering & cost governance

## Status
Accepted

## Date
2026-08-07

## Context
Research §2.3 and §7 establish the cost/quality shape of the problem: a "cheap-first, LLM-as-fallback" pipeline where a Haiku-class model resolves the bulk of the Tier 2 workload and a Sonnet/Opus-class frontier model is reserved for genuinely hard cases (phishing intent, BEC framing, nuanced prioritization). The research notes Anthropic's Batch API gives a **50% discount** on input/output tokens for async (within-24h) jobs, "a strong fit for a nightly/periodic reclassification sweep or backlog triage, vs. interactive real-time triage which would use standard (non-batch) pricing" (research §2.3). It also flags this as a genuinely open decision (research §6, open decision #6): "model the expected daily message volume per user against expected LLM spend before committing."

**Caveat on evidence quality**: the specific pricing figures and Haiku/Sonnet/Opus positioning cited in the research are drawn from third-party pricing-guide blogs (CloudZero, pecollective — research §2.3 sources), not Anthropic's own pricing page at implementation time. This ADR's cost model must be validated against current Anthropic pricing before launch and re-validated on every pricing change, not treated as a fixed constant.

## Decision
- **Provider**: Anthropic, exclusively, for all LLM tiers. Single-provider integration keeps prompt/response handling, structured-output parsing, and cost accounting uniform (see [[0002-technology-stack-selection]]).
- **Model tiering** maps directly onto the pipeline tiers in [[0005-tiered-classification-pipeline]]:
  - Tier 2 (bulk classification): Haiku-class model — structured JSON output, ~5 few-shot examples per label category (research §2.3), multi-label over the 11 categories plus confidence.
  - Tier 3 (hard tail): Sonnet-class model by default; Opus-class reserved for the highest-stakes phishing/BEC cases as a further internal escalation, not a separate pipeline tier — configurable without a pipeline redesign.
- **Batch vs. interactive routing**: messages in phishing-adjacent, needs-reply-candidate, or prioritization-relevant paths use **standard interactive pricing** for low latency (per the urgent-path routing in [[0004-real-time-ingestion-with-delta-sync-backstop]] and the SLA targets in [[0016-observability-slas-alerting]]). Messages Tier 1 already resolved with high confidence but which are queued for **confirmation/backfill sampling** (see [[0014-feedback-loop-continuous-learning]]) use the **Batch API** (50% discount) on a nightly cadence, since staleness has no user-facing cost for that path.
- **Per-tenant cost governance**: every classification job is metered (input/output tokens, tier, batch-vs-interactive) and attributed to a tenant. Each tenant plan (see [[0021-usage-metering-billing]]) carries a **soft budget threshold** (triggers an internal alert and a shift toward more Tier-1/Tier-2-only routing for that tenant) and a **hard budget ceiling** (triggers throttling of Tier 3 escalation with the residual routed to Tier 2 at lower confidence, never a silent drop of the message — it still gets *a* classification, just a cheaper one, and is flagged for later reconciliation). Ceilings are configurable by plan and by tenant-level override for enterprise contracts.
- **Cost modeling gate**: before launch and before any pricing-affecting model change, expected daily message volume per tenant tier is modeled against current Anthropic pricing (not the cached figures in the research) to set default budget thresholds — owned by whichever team also owns [[0021-usage-metering-billing]].

## Consequences

### Positive
- Directly operationalizes the research's cost-ratio argument (research §2.3): keeping expensive-tier volume to the genuinely ambiguous tail is what makes the tiered pipeline commercially viable at all.
- Per-tenant budget ceilings mean one tenant's unusually high mail volume or unusually ambiguous mail mix cannot create unbounded cost exposure for the business — essential for a fixed-plan-pricing SaaS.
- Batch API use for non-urgent confirmation sampling gets us continuous accuracy feedback (see [[0014-feedback-loop-continuous-learning]], [[0022-testing-and-evaluation-strategy]]) at half the per-token cost.

### Negative
- Single-provider dependency on Anthropic for all three tiers; no automatic multi-provider failover.
- Budget-ceiling degradation (routing to a cheaper tier under cost pressure) means classification quality for a mailbox can silently vary based on cost state, not just message content — must be surfaced in observability (see [[0016-observability-slas-alerting]]) so it's a visible, debuggable state, not a hidden one.

### Risks
- Pricing changes on Anthropic's side directly move the unit economics of the entire product; the research itself flags its cited figures as time-bound ("as of Aug 2026") and sourced from secondary blogs. Mitigated by the explicit re-validation requirement above and by keeping the tier-routing thresholds configuration, not hardcoded, so cost/quality trade-offs can be retuned without a code change.

## Alternatives Considered
- **Multi-provider (e.g., add OpenAI or an open-weight model as a cost-competitive Tier 2 alternative)** — rejected for v1: adds prompt-portability and eval-harness complexity (two sets of structured-output quirks, two cost models) before we have production data justifying the switching cost. Revisit if Anthropic pricing or availability materially changes.
- **Single model tier for everything (no Haiku/Sonnet/Opus split)** — rejected: directly contradicts the research's cost-ratio findings (research §2.3) and would either overpay for easy volume or underpower the hard tail.
- **No hard per-tenant budget ceiling (best-effort cost monitoring only)** — rejected: unbounded per-tenant cost exposure is incompatible with fixed-price SaaS plans (see [[0021-usage-metering-billing]]).

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0014-feedback-loop-continuous-learning]], [[0021-usage-metering-billing]], [[0022-testing-and-evaluation-strategy]]
