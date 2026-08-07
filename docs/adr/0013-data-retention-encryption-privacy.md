# 0013. Data retention, encryption & privacy/compliance posture

## Status
Accepted

## Date
2026-08-07

## Context
Research §5.4 identifies reading full email content as "a high-sensitivity operation (personal/medical/financial/legal content plus auth codes)" and recommends we "minimize retention (process-and-discard where possible rather than storing full bodies), encrypt tokens and any stored content at rest." As a commercial multi-tenant SaaS handling EU/US personal data across many tenants' inboxes, the system is squarely in scope for GDPR and CCPA-relevant obligations: data minimization, purpose limitation, right to erasure, and breach notification. This is a product requirement, not merely a research recommendation — email content routinely contains special-category or highly sensitive data (health, financial, legal) even though the taxonomy itself is about triage, not content analysis for its own sake.

## Decision
- **Minimal retention of email bodies**: full message bodies are **not persisted** beyond the transient window needed to classify (Tier 1–3, see [[0005-tiered-classification-pipeline]]) and score (see [[0009-prioritization-urgency-scoring-model]]) a message. Only the following are durably stored: the `NormalizedMessage` metadata needed for future operation (sender, subject, thread/conversation id, header-derived signals, timestamps), the classification result (`message_labels`, `priority_score`, `phishing_flag` — see [[0006-multi-label-classification-data-model]]), and platform message references (Gmail message id, Graph message id) sufficient to re-fetch content on demand rather than storing it redundantly. A short-lived cache of body content (bounded TTL, default measured in hours) supports the confirmation-sampling and reprocessing needs of [[0003-platform-normalization-layer]] and [[0014-feedback-loop-continuous-learning]], after which it is purged.
- **Encryption**: all data at rest (Postgres, Redis, object storage if used for the transient body cache) is encrypted using provider-managed encryption at minimum, with field-level encryption for the most sensitive columns (subject lines, any retained snippet used for few-shot/correction examples). All data in transit uses TLS. OAuth tokens follow the dedicated policy in [[0012-oauth-token-lifecycle-secrets]].
- **Per-tenant data isolation**: enforced at the database layer per [[0015-multi-tenancy-data-isolation]] — this ADR treats isolation as a privacy control, not only an architectural one: one tenant must never be able to query, even accidentally, another tenant's message metadata or classification history.
- **Right to erasure**: a tenant-initiated or user-initiated deletion request purges all durably stored metadata, classification history, cached content, and reputation-cache entries tied to that tenant/mailbox within a defined SLA (default: 30 days, faster on request), logged as a compliance event.
- **Sub-processor disclosure**: Anthropic (LLM classification, see [[0007-llm-provider-model-tiering-cost-governance]]) is a data sub-processor and is disclosed as such in the tenant-facing privacy policy and data processing agreement (DPA); message content sent to the LLM tiers is scoped to what's needed for classification (not full raw MIME) and is not used to train models outside the terms of our provider agreement.
- **Consent and purpose limitation**: data collected is used only for the stated triage/classification purpose and the feedback-loop improvement described in [[0014-feedback-loop-continuous-learning]] — not resold, not used for unrelated profiling, and this limitation is reflected in the OAuth consent-screen justification from [[0012-oauth-token-lifecycle-secrets]].

## Consequences

### Positive
- Minimizing body retention substantially reduces breach impact — a database compromise exposes classification metadata and labels, not a durable archive of tenants' full email content.
- GDPR/CCPA-aligned posture (data minimization, erasure, sub-processor disclosure, purpose limitation) is a prerequisite for selling into any regulated or enterprise market, not optional polish.
- Encrypting at rest plus per-tenant isolation gives a strong, explainable security story for enterprise sales security reviews.

### Negative
- Not persisting full bodies means any reclassification or debugging of a past decision after the cache TTL expires requires re-fetching content from the platform API (subject to token validity and quota — see [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0012-oauth-token-lifecycle-secrets]]), rather than a local replay.
- Field-level encryption and strict TTL-based purging add implementation and query complexity relative to a naive "store everything" design.

### Risks
- The few-shot/correction examples used for continuous learning (see [[0014-feedback-loop-continuous-learning]]) inherently require retaining *some* content snippets longer than the general body-cache TTL — this is a deliberate, narrower exception that must itself be minimized (redacted/truncated where possible) and disclosed, not an unbounded carve-out.
- Cross-border data transfer (tenant in the EU, infrastructure region, Anthropic API region) requires an explicit transfer-mechanism decision (e.g., SCCs) as part of the DPA — flagged here as a compliance dependency owned jointly with legal/compliance function, not fully resolved by this ADR alone.

## Alternatives Considered
- **Store full email bodies indefinitely for richer future features (search, archival)** — rejected: directly contradicts research §5.4's minimization guidance, materially raises breach impact and compliance burden, and is not needed for the triage/classification use case this product is scoped to.
- **No sub-processor disclosure / bury LLM data flow in generic "third-party services" language** — rejected: GDPR/CCPA and enterprise DPA norms require explicit sub-processor disclosure; omitting it is a compliance and sales-blocking risk.

## Related ADRs
[[0006-multi-label-classification-data-model]], [[0007-llm-provider-model-tiering-cost-governance]], [[0012-oauth-token-lifecycle-secrets]], [[0014-feedback-loop-continuous-learning]], [[0015-multi-tenancy-data-isolation]]
