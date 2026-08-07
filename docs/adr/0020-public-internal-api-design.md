# 0020. Public/internal API design for client UI and third-party integrations

## Status
Accepted

## Date
2026-08-07

## Context
[[0001-server-side-middleware-saas-architecture]] establishes that any web UI or future add-in is a thin consumer of the backend, not a separate implementation of classification logic — this requires a well-defined API surface, not an ad hoc one. The system also produces data types (multi-label classification results, priority scores with per-signal explanation, phishing flags, quarantine actions, feedback/correction actions, usage/billing state) that a UI, and potentially third-party integrations (e.g., a tenant's own automation connecting to our classification results), need to consume in a stable, versioned way.

## Decision
- **One authenticated REST API** (versioned, e.g., `/v1/...`) serves both our own first-party web UI and any third-party/tenant integrations — there is no separate "internal-only" API with different semantics from the public one; internal consumers use the same contract as external ones, which forces the API to be genuinely well-designed rather than accreting internal-only shortcuts.
- **Core resource model**, matching the data model in [[0006-multi-label-classification-data-model]]: messages (with their multi-label classification, priority score and its per-signal breakdown per [[0009-prioritization-urgency-scoring-model]], and phishing status per [[0010-phishing-detection-layering-and-incident-response]]), mailbox connections (OAuth connection lifecycle, see [[0012-oauth-token-lifecycle-secrets]]), tenant configuration (VIP lists, category rule overrides, budget settings per [[0007-llm-provider-model-tiering-cost-governance]]), corrections/feedback (the explicit correction action from [[0014-feedback-loop-continuous-learning]]), and usage/billing (see [[0021-usage-metering-billing]]).
- **Authentication**: tenant-scoped API keys or OAuth-based tenant user sessions for the first-party UI; third-party integration access uses scoped API keys with the same tenant-isolation guarantees as [[0015-multi-tenancy-data-isolation]] enforced at the API layer in addition to the database layer (defense in depth — an API-layer bug must not be the only thing standing between a request and another tenant's data).
- **Webhooks out**: tenants/integrations can subscribe to our own webhook events (e.g., "message classified," "phishing quarantined," "SLA-relevant category detected") — mirroring the ingestion pattern we ourselves depend on from Gmail/Graph (see [[0004-real-time-ingestion-with-delta-sync-backstop]]), but since our own delivery is not free of the same "no guaranteed delivery" caveat, we apply the same lesson: our outbound webhooks are a latency optimization, and the REST API remains the authoritative, poll-able source of truth for any integration that cannot tolerate a missed event.
- **Rate limiting and quota**: API rate limits are tied to the tenant's plan tier (see [[0021-usage-metering-billing]]), independent of the internal platform-quota rate limiting in [[0017-scalability-queueing-autoscaling]] (which governs our calls *out* to Gmail/Graph, not calls *in* from tenants).
- **Versioning and deprecation**: breaking changes require a new API version; the current version is supported for a defined minimum deprecation window before retirement, published in API documentation.

## Consequences

### Positive
- A single, externally-consumable API forces good API hygiene (stable contracts, proper versioning, real documentation) that a purely-internal API often erodes over time.
- Sharing the contract between first-party UI and third-party integrations means the UI never has an unfair capability advantage over integrations — a healthy signal for API quality and a real product differentiator (integration-friendliness) for the commercial offering.
- Applying the "no guaranteed delivery, poll as backstop" lesson to our own outbound webhooks avoids repeating the exact reliability mistake the research warns about for Gmail/Graph's own webhooks (research §1.1, §1.2).

### Negative
- Designing for external consumption from day one is more upfront work than a loosely-specified internal API a UI team iterates on freely — every field and endpoint needs to be considered stable-contract-worthy, not just "whatever the UI currently needs."
- Supporting third-party integration access (scoped API keys, rate limits, webhook subscriptions) is scope beyond the minimum needed to ship a first-party UI, representing a deliberate investment in commercial extensibility.

### Risks
- API-layer tenant-scoping is a second enforcement point alongside database RLS (see [[0015-multi-tenancy-data-isolation]]); if the two drift out of sync (e.g., an API endpoint that bypasses expected scoping logic), the RLS layer is the backstop — but this ADR's defense-in-depth intent depends on both layers actually being exercised in testing (see [[0022-testing-and-evaluation-strategy]]), not just one.

## Alternatives Considered
- **Separate internal-only API for the first-party UI, distinct public API for integrations** — rejected: doubles the surface to design, document, and secure, and historically internal-only APIs accrete inconsistencies that make a later public API harder to design well; a single shared contract avoids this by construction.
- **GraphQL instead of REST** — considered given the relatively rich, nested resource model (messages with multiple labels, per-signal score breakdowns); rejected for v1 in favor of REST for lower operational complexity and broader tenant/integration-developer familiarity, revisitable if integration partners specifically request it.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0006-multi-label-classification-data-model]], [[0009-prioritization-urgency-scoring-model]], [[0014-feedback-loop-continuous-learning]], [[0015-multi-tenancy-data-isolation]], [[0021-usage-metering-billing]]
