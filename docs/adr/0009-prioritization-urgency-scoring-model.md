# 0009. Prioritization / urgency scoring model

## Status
Accepted

## Date
2026-08-07

## Context
Research §2.5 describes a composite, weighted-signal approach to urgency scoring rather than a binary VIP/non-VIP flag, and explicitly warns that "pure VIP-list approaches have a known blind spot: they treat every message from a VIP identically regardless of content, and they cannot catch new important senders... who aren't yet on the list." The research's recommended composite signal set (research §2.5): (a) static/dynamic VIP list (manual + auto-promoted by reply frequency), (b) historical interaction frequency (derived from message history), (c) content-based urgency (keyword/deadline detection or LLM judgment), (d) calendar proximity (meeting referenced within N hours), (e) the "needs a reply" flag itself as an input (unanswered + old = escalate).

**Evidence-quality caveat carried into this decision**: the research is explicit that "the specific '4-signal, 0–100 score' architecture comes from a single marketing/product blog, not a peer-reviewed or platform-official source — treat as one plausible design pattern to validate against your own data, not a proven formula" (research §2.5). We therefore adopt the *shape* of a composite weighted score, not a specific formula presented as ground truth, and require empirical validation once labeled data exists.

## Decision
`priority_score` (0–100, see [[0006-multi-label-classification-data-model]]) is computed as a **weighted composite** over five signals, matching the research's recommended set:

1. **VIP status** — tenant-curated list plus auto-promotion based on observed reply frequency (see interaction-frequency signal below); highest static weight.
2. **Interaction frequency** — derived from the tenant's own Gmail/Graph message history (how often the user replies to this sender), computed and cached per sender (see [[0014-feedback-loop-continuous-learning]] for reputation-cache mechanics), directly addressing the research's "blind spot" critique of static VIP lists by letting *new* important senders earn priority without manual list maintenance.
3. **Content-based urgency** — keyword/deadline detection (Tier 1) escalating to LLM judgment (Tier 2/3) per [[0005-tiered-classification-pipeline]] for nuance a keyword scan misses.
4. **Calendar proximity** — a message referencing a meeting occurring within a configurable window (default N=24h) scores higher, cross-referenced against the tenant's calendar where available.
5. **Needs-reply flag** — feeds forward into the score itself (unanswered + aging = escalating urgency), not just a sibling label, per research §2.5's explicit inclusion of this as an input signal.

Initial per-signal weights are seeded from the research's design pattern as a starting point, versioned alongside the pipeline (`pipeline_version` in [[0006-multi-label-classification-data-model]]), and **must be empirically retuned** against real tenant correction data collected via [[0014-feedback-loop-continuous-learning]] once sufficient volume exists — this satisfies the evidence-quality caveat above by treating the initial formula as a hypothesis, not a launch-blocking requirement to "get right" from marketing-sourced numbers alone. Weight changes go through the same shadow-evaluation gate as any other scoring change (see [[0018-deployment-cicd-safe-rollout]]).

## Consequences

### Positive
- Directly addresses the VIP-list blind spot the research calls out: a new, unlisted but frequently-replied-to sender gets appropriate priority without manual curation.
- Composite, content-aware scoring degrades gracefully — no single missing signal (e.g., no calendar access granted) zeroes out the score, it just drops one weighted term.
- Versioned, retunable weights let us treat the launch formula as a starting hypothesis rather than a permanent commitment to a single marketing-sourced design, consistent with the research's own evidence-quality caveat.

### Negative
- A composite score is harder for a user to intuitively understand than a binary VIP flag ("why is this a 62 and not a 70?") — requires a score-explanation surface in the API/UI (see [[0020-public-internal-api-design]]) showing per-signal contributions, not just the final number.
- Weight retuning requires enough labeled correction volume to be statistically meaningful; early-stage tenants with low volume get less-validated scores than mature ones.

### Risks
- Because the underlying formula source is lower-confidence (research §2.5 evidence-quality note), launching with unvalidated weights risks visibly poor prioritization in the early period. Mitigated by treating priority scoring as eligible for the shadow-evaluation and canary process in [[0018-deployment-cicd-safe-rollout]] from day one, and by defaulting new tenants to a conservative scoring band (avoid over-committing to "high priority" until the sender/content signals have enough history) rather than an aggressive one.

## Alternatives Considered
- **Binary VIP/non-VIP flag only** — rejected per the research's explicit critique (research §2.5): misses new important senders and ignores content, an accuracy regression relative to the composite approach for no complexity savings that matters at our scale.
- **Fully LLM-driven priority scoring (no deterministic composite)** — rejected: more expensive (every message needs an LLM call for scoring, defeating the Tier 1 cost savings in [[0005-tiered-classification-pipeline]]) and less explainable/auditable than a composite of named, weighted signals.
- **Treat priority as a category label (single-label: low/medium/high) instead of a 0-100 score** — rejected: the research's composite-signal framing and the calendar-proximity/needs-reply escalation dynamics are inherently continuous, and a coarse 3-bucket label would lose the ranking granularity needed for a "sort by urgency" UI.

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0014-feedback-loop-continuous-learning]], [[0018-deployment-cicd-safe-rollout]], [[0020-public-internal-api-design]]
