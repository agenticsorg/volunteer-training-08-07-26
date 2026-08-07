# 0014. Feedback loop & continuous learning

## Status
Accepted

## Date
2026-08-07

## Context
The research flags this as an open decision (research §6, open decision #7): "decide whether corrections are captured passively (user moves a message to a different label/folder — inferred correction) or require an explicit UI action (more reliable signal, more friction) — passive inference is more scalable but noisier (a user moving a message for reasons unrelated to category correctness would pollute the training signal)." The research's overall architecture diagram (research §6) places a feedback loop at the end of the pipeline: "user corrections... captured as labeled data, feeds few-shot example refresh + sender-reputation cache updates."

## Decision
We adopt a **hybrid** capture model rather than choosing purely passive or purely explicit, resolving the open decision as follows:

- **Passive signal (always-on, low friction)**: a user re-labeling, moving, or re-foldering a message in Gmail/Outlook directly (detected on the next delta-sync per [[0004-real-time-ingestion-with-delta-sync-backstop]]) is captured as a **weak, unconfirmed correction signal** — logged with lower trust weight, because the research explicitly warns this can be noisy (moved for unrelated reasons). Weak signals are aggregated and only promoted to affect the sender-reputation cache or few-shot examples once a *consistent pattern* emerges (e.g., the same correction repeated across several messages from the same sender, or across a meaningful fraction of a tenant's messages in a category) — a single passive signal never unilaterally changes shared model behavior.
- **Explicit signal (opt-in, high trust)**: a dedicated, low-friction "this was miscategorized" action surfaced in the product UI/API (see [[0020-public-internal-api-design]]) is captured as a **high-trust, confirmed correction** — used directly to refresh few-shot examples (research §2.3's ~5-examples-per-label guidance) and update sender-reputation cache entries without requiring pattern aggregation first.
- **Two consumers of correction data**, matching the research's architecture diagram (research §6):
  1. **Sender-reputation cache** (research §5.3) — per-sender-domain category priors that let Tier 1 resolve future mail from the same sender with higher confidence without a repeat LLM call.
  2. **Few-shot example refresh** — confirmed corrections (explicit, or high-confidence aggregated passive) become candidate few-shot examples for Tier 2/3 prompts (research §2.3 recommends single-label, unambiguous examples outperform ambiguous multi-label ones — aggregated/confirmed corrections are filtered for this property before inclusion).
- **Per-tenant vs. global learning boundary**: sender-reputation and few-shot updates derived from a tenant's corrections apply **within that tenant's scope by default** (respecting [[0015-multi-tenancy-data-isolation]] and the privacy posture in [[0013-data-retention-encryption-privacy]]). Promotion of a pattern to the *global* seed dataset (research §5.3's shared bulk-sender/brand-domain lists) requires the pattern to be corroborated across multiple tenants and contains no tenant-identifying content — this is a deliberate, narrow exception, not a default data flow.
- **Model/prompt versioning**: every few-shot set and sender-reputation snapshot used in a classification is tied to `pipeline_version` (see [[0006-multi-label-classification-data-model]]), and updates are rolled out through the same shadow-evaluation gate as any other pipeline change (see [[0018-deployment-cicd-safe-rollout]]) rather than applied live and unreviewed.

## Consequences

### Positive
- Directly resolves the research's open decision with a concrete, defensible policy rather than leaving "passive vs. explicit" unresolved: we get the scale of passive signal and the reliability of explicit signal, using aggregation as the bridge between them.
- Sender-reputation caching reduces future LLM calls for repeat senders, compounding the cost savings from [[0007-llm-provider-model-tiering-cost-governance]] over a tenant's lifetime.
- Versioned, gated rollout of learned changes means a bad correction pattern (e.g., a tenant systematically mis-training a category due to unusual personal workflow) can be caught in shadow evaluation before it affects that tenant's — or worse, the global — classification quality.

### Negative
- Aggregation-before-promotion for passive signals means passive corrections take longer to influence behavior than explicit ones — an intentional trade-off for noise reduction, but it means "the system learns slowly" for a tenant who never uses the explicit correction action.
- Maintaining a tenant-scoped vs. global learning boundary adds data-modeling and governance complexity beyond a single shared learning pool.

### Risks
- A tenant with unusual personal categorization preferences (e.g., considers LinkedIn digests high-priority, contrary to most tenants) could pollute tenant-scoped few-shot examples in ways that degrade classification for *that tenant's* edge cases — acceptable since it's scoped to them, but should be visible/auditable so support can diagnose "why does my classification behave oddly" complaints.
- Adversarial or careless bulk corrections (e.g., a tenant mass-moves mail during an inbox cleanup unrelated to category correctness) could still pollute the aggregated passive signal if the aggregation threshold is too low — mitigated by requiring pattern consistency across senders/time, not just volume, before promotion.

## Alternatives Considered
- **Passive-only correction capture** — rejected per the research's own noise warning (research §6 open decision #7): unconfirmed inference alone risks polluting shared learning artifacts with corrections unrelated to actual category accuracy.
- **Explicit-only correction capture** — rejected: forgoes the scale advantage of passive signal the research identifies, and most users will not proactively use a dedicated "fix this" action for the majority of minor miscategorizations — most of the real-world signal would be lost.
- **Immediate, ungated application of corrections to shared model behavior** — rejected: bypasses the safe-rollout discipline established in [[0018-deployment-cicd-safe-rollout]] and risks a single bad correction (or small set of them) degrading classification quality in production with no review step.

## Related ADRs
[[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0007-llm-provider-model-tiering-cost-governance]], [[0009-prioritization-urgency-scoring-model]], [[0015-multi-tenancy-data-isolation]], [[0018-deployment-cicd-safe-rollout]], [[0022-testing-and-evaluation-strategy]]
