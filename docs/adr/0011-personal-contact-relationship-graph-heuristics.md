# 0011. Personal contact & relationship-graph detection heuristics

## Status
Accepted

## Date
2026-08-07

## Context
Research §2.6 gives a converging signal set for distinguishing personal contacts from automated senders, explicitly noting "no single header is fully reliable — combine as a weighted rule/score rather than a hard gate, since some real people send from role accounts and some automated systems don't set the RFC 3834 headers correctly." The signals identified: absence of `List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`, `List-Id` headers (research §2.1, §2.6); a `From` address that is not a `noreply@`/`notifications@`/`no-reply@` pattern; presence in the tenant's People/Contacts API results or Gmail "Other contacts" (auto-collected — research §1.1); bidirectional thread history (the user has sent mail *to* this address before, not just received — research §2.6); and a personal-looking display name (lowest-confidence heuristic). The research also notes the People API does not itself expose an interaction-frequency score — that must be derived from message history by the application (research §1.1).

## Decision
Personal-contact detection is implemented as a **weighted score** (not a hard gate), consistent with research §2.6's explicit recommendation, combining:

1. **Automation-header absence** (weight: high) — none of `List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted: auto-generated`, `List-Id` present.
2. **From-address pattern** (weight: medium) — not matching `noreply@`/`no-reply@`/`notifications@`/`donotreply@` and similar patterns.
3. **Contacts-API presence** (weight: high) — sender appears in Gmail People API contacts/"Other contacts" or Outlook contacts.
4. **Bidirectional thread history** (weight: high) — the tenant has sent mail *to* this address, derived from thread/conversation history (`threadId`/`conversationId`, same structural signal used for needs-reply detection — research §2.4), not merely received from it.
5. **Display-name heuristic** (weight: low) — personal-looking name pattern, used only as a tie-breaker among otherwise-ambiguous scores.

This score feeds two consumers: (a) the **Personal Contacts** category label itself (see [[0006-multi-label-classification-data-model]]), and (b) the **interaction-frequency** signal in the prioritization scorer (see [[0009-prioritization-urgency-scoring-model]]), since a confirmed personal, bidirectional relationship is itself evidence of importance. The score and its component signals are computed at Tier 1 (research §2.1's rule tier) since all inputs are structural/header-based, not content-semantic — no LLM call is needed for this category, keeping it near-zero marginal cost per [[0005-tiered-classification-pipeline]].

Per-sender results are cached (sender → personal-contact score, refreshed periodically) as part of the sender-reputation cache described in research §5.3, avoiding recomputation of thread-history lookups for every message from a known, already-scored sender.

## Consequences

### Positive
- Matches the research's explicit guidance to weight-score rather than hard-gate, correctly handling both "real people on role accounts" and "automated systems with missing RFC 3834 headers" without misclassifying either as a hard failure.
- Entirely rule-tier (no LLM cost) for a category that is high-volume-adjacent (every message needs *some* personal-vs-automated signal, since it also feeds prioritization) — keeping this off the LLM path matters for the cost model in [[0007-llm-provider-model-tiering-cost-governance]].
- Reuses the thread/conversation-state signal already computed for needs-reply detection (research §2.4), avoiding duplicate infrastructure.

### Negative
- Weighted scoring means edge cases (a real person who emails from a role account with automated-looking headers) may score ambiguously and require a confidence threshold decision (route to soft "possible personal contact" vs. omit the label) rather than a clean binary answer.
- Sender-reputation caching introduces staleness risk: a sender's status can genuinely change (a personal contact starts sending from a new work role account) — mitigated by periodic cache refresh and immediate invalidation on strong contradicting signal (e.g., a sudden `List-Unsubscribe` header appearing from a previously "personal" sender).

### Risks
- Privacy sensitivity: deriving a relationship graph (who the tenant has bidirectional contact with, and how often) is itself sensitive personal data about the tenant's social/professional graph, not just about the incoming mail — this data must be covered by the same retention/encryption/isolation posture as email content (see [[0013-data-retention-encryption-privacy]]), not treated as "just metadata."

## Alternatives Considered
- **Hard-gate rule (any automation header present ⇒ not personal)** — rejected per research §2.6's explicit warning that this misclassifies real people on role accounts and automated systems with missing headers; a weighted score is materially more accurate for the same implementation cost.
- **LLM-based personal-contact classification** — rejected: research §2.1/§2.6 signals are structural/header-based and near-deterministic; adding an LLM call here would add cost and latency (see [[0005-tiered-classification-pipeline]]) for a category that rules already resolve with high confidence.
- **Rely solely on Contacts/People API presence** — rejected: research §1.1 notes this API alone doesn't expose interaction frequency and would miss any personal contact not yet saved/auto-collected, undercounting genuine relationships (e.g., a new personal contact who hasn't yet been auto-added to "Other contacts").

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0009-prioritization-urgency-scoring-model]], [[0013-data-retention-encryption-privacy]], [[0014-feedback-loop-continuous-learning]]
