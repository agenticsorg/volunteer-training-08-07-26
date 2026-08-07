# 0021. Usage metering & billing integration

## Status
Accepted

## Date
2026-08-07

## Context
This is a commercial, multi-tenant SaaS, and its dominant marginal cost is LLM usage (see [[0007-llm-provider-model-tiering-cost-governance]]), which scales with per-tenant message volume and classification-tier distribution — not a fixed cost independent of usage. The research's cost-ratio analysis (research §2.3) is precisely what makes tiered pricing plans viable: because rules resolve the majority of volume near-zero cost, per-tenant marginal cost stays bounded even for high-volume tenants, but it is not zero, and plan pricing must be grounded in real measured unit economics, not guesswork.

## Decision
- **Usage metering**: every classification job records tenant id, message count, tier reached (1/2/3), token counts (input/output, batch vs. interactive — see [[0007-llm-provider-model-tiering-cost-governance]]), and platform-API call counts (against Gmail/Graph quota — see [[0017-scalability-queueing-autoscaling]]) as structured, queryable usage events, not just aggregate logs — enabling both real-time budget-ceiling enforcement ([[0007-llm-provider-model-tiering-cost-governance]]) and after-the-fact billing reconciliation from the same data.
- **Plan model**: tiered plans (e.g., Starter/Growth/Enterprise) differentiated by: included monthly message-classification volume, SLA tier (see [[0016-observability-slas-alerting]] — time-critical latency floor is universal, but reconciliation-interval tightness and priority queue placement scale with plan), number of connected mailboxes per tenant, and access to enterprise-only features (dedicated-instance deployment per [[0015-multi-tenancy-data-isolation]], custom VIP/category rule limits).
- **Overage handling**: usage beyond a plan's included volume is either metered overage billing or soft-throttled to the budget-ceiling degradation behavior already defined in [[0007-llm-provider-model-tiering-cost-governance]] (cheaper-tier-only classification, never a dropped message), configurable per plan — self-serve plans default to throttle-not-bill-surprise, enterprise contracts may negotiate metered overage instead.
- **Billing integration**: usage events are aggregated into a billing period and pushed to a third-party billing/subscription-management provider (e.g., Stripe Billing) rather than building bespoke invoicing — usage-based billing is a well-solved problem and building it from scratch is not a differentiator for this product.
- **Cost-model validation loop**: actual measured per-tenant LLM/API cost (from usage metering) is periodically compared against the plan-pricing assumptions from [[0007-llm-provider-model-tiering-cost-governance]]'s cost-modeling gate, closing the loop between the initial (pre-launch) cost model and real observed unit economics — pricing and budget-ceiling defaults are revisited based on this data, not left as launch-time assumptions indefinitely.

## Consequences

### Positive
- Fine-grained usage events double as both the billing source of truth and the operational cost-governance input from [[0007-llm-provider-model-tiering-cost-governance]] — one data pipeline serves two critical functions instead of building them separately.
- Throttle-not-surprise-bill as the self-serve default avoids the classic SaaS trust failure of unexpected large bills from usage spikes, while still protecting our own margin via the budget-ceiling degradation path.
- Delegating invoicing/subscription mechanics to a billing provider keeps engineering focus on the product's actual differentiator (classification quality), not payment infrastructure.

### Negative
- Fine-grained per-message usage event recording adds write volume and storage cost proportional to total message volume across all tenants — a real, if small, additional operational cost layered on top of the classification pipeline itself.
- Tying SLA tightness to plan tier (beyond the universal time-critical floor) adds product/config complexity — different tenants genuinely receive different reconciliation intervals and queue priority, which must be consistently enforced across [[0016-observability-slas-alerting]] and [[0017-scalability-queueing-autoscaling]].

### Risks
- If the initial cost model (built on the research's own flagged lower-confidence pricing figures — see [[0007-llm-provider-model-tiering-cost-governance]]) is meaningfully wrong, launch pricing could be mispriced relative to actual cost; the cost-model validation loop above is the explicit mitigation, but early-adopter pricing risk during the period before enough usage data accumulates is accepted as a known launch risk.

## Alternatives Considered
- **Flat-rate pricing regardless of usage** — rejected: given LLM cost is the dominant marginal cost and scales with tenant volume (research §2.3), flat pricing either overcharges low-volume tenants (hurting competitiveness) or undercharges high-volume ones (eroding margin) — usage-tiered plans are necessary given the cost structure the research itself establishes.
- **Build billing/invoicing in-house** — rejected: subscription billing, dunning, tax handling, and invoicing are a solved, non-differentiating problem; building it ourselves is opportunity cost better spent on classification quality.
- **Hard cutoff (service stops) on plan-volume exhaustion instead of throttle-or-overage** — rejected: a hard stop means a tenant's mail simply stops being classified/triaged, which is a worse failure mode for both tenant trust and support burden than graceful throttling to cheaper-tier classification (already established as the mechanism in [[0007-llm-provider-model-tiering-cost-governance]]).

## Related ADRs
[[0007-llm-provider-model-tiering-cost-governance]], [[0015-multi-tenancy-data-isolation]], [[0016-observability-slas-alerting]], [[0017-scalability-queueing-autoscaling]], [[0020-public-internal-api-design]]
