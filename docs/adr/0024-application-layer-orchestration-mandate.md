# 0024. Application-layer orchestration mandate per bounded context

## Status
Accepted

## Date
2026-08-21

## Context
An audit of the running codebase against `docs/implementation-plan.md` and `docs/ddd/context-map.md` found that 6 of the 10 bounded contexts — Mailbox Ingestion, Contact Graph, Threat Detection, Prioritization, Feedback & Learning, and Notification & Alerting — contain only `domain/` and `infrastructure/` folders, with **no `application/` layer**. Their aggregates, value objects, and repositories are real and individually unit-tested (tracked as GitHub issue #31), but nothing in the running application ever constructs a command from an inbound event and calls them. By contrast, Tenant & Subscription, Identity & Access, Classification, and Mailbox Write-back each have a working `application/` layer with real orchestration.

Concretely, this means: `SenderProfile` (Contact Graph) is never updated from a real ingested message (issue #41); `LookalikeScore` (Threat Detection) is never instantiated outside tests and has no path to consult Contact Graph (issue #43); `MessagePriority` (Prioritization) is never recomputed from a real classification or contact event (issue #44); `CorrectionRecord` (Feedback & Learning) never observes a real `WriteBackDivergenceDetected` or `QuarantineOverridden` (issue #47); and `AlertDispatch` (Notification & Alerting) never fires from a real `MessageQuarantined` or `MessagePriorityEscalated` (issue #48). Fixing [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md) alone is necessary but not sufficient — there also needs to be a standing architectural requirement, enforced in CI rather than left to convention, that every context receiving published events actually has code that reacts to them.

## Decision
- **Every bounded context that appears as a "Customer" of another context's published event in `docs/ddd/context-map.md`'s relationship table MUST have an `application/` directory** containing named application services with explicit event-consumer handlers (`@OnEvent`, wired to the durable backbone from [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md), not the in-process emitter) that translate each inbound event into a command against that context's aggregate(s) via its repository.
- **Minimum per-context application-service contract**:
  1. One consumer per subscribed upstream event, named for the event it handles (e.g., `MessageIngestedContactGraphHandler`).
  2. Idempotent command handling, keyed by the event's aggregate id, consistent with the at-least-once delivery semantics from [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md).
  3. Publication of the context's own resulting domain event(s) back through the same outbox mechanism, not a bespoke path.
- **CI structural check**: any context module whose `domain/events` folder defines an event class with zero corresponding `@OnEvent` registrations anywhere in the deployed application fails the build. Paired with [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md)'s publish-side outbox-routing check, this closes the loop from both ends: nothing can be published with no consumer, and nothing can be declared a subscriber (per `context-map.md`) with no handler.
- **Retrofit priority order** for the six gapped contexts, sequenced by the dependency order already established in `docs/implementation-plan.md` so each retrofit's upstream data is available when it's built: Mailbox Ingestion (unblocks every content-driven context downstream) → Contact Graph → Threat Detection → Prioritization → Feedback & Learning → Notification & Alerting.
- **Exemption path**: an event genuinely consumed only outside the monolith (e.g., an outbound webhook payload per [0020-public-internal-api-design](0020-public-internal-api-design.md)) is marked with an explicit `// @external-consumer-only` annotation recognized by the CI check, rather than silently passing or requiring a fake internal listener.

## Consequences

### Positive
- Converts tested-but-inert domain code in six contexts into an actually-running pipeline — this is the concrete fix that makes [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md)'s delivery mechanism do anything.
- Makes "does this context actually do anything at runtime" a CI-enforced property instead of something only discoverable by manual audit, as it was here.
- Gives each retrofit a clear, small, independently shippable unit of work (one context's application layer at a time) rather than a single large cross-cutting change.

### Negative
- Adds a mandatory structural layer (and its boilerplate — DTOs, handler registration, idempotency bookkeeping) to every context going forward, including future new contexts.
- Retrofitting six existing contexts is nontrivial effort; it is not a mechanical find-and-wire exercise, since several of the affected aggregates (`SenderProfile`'s From-address signal per issue #40, `ThreatAssessment.overrideQuarantine` per issue #42) have their own correctness bugs that surface once real data flows through them.

### Risks
- The CI structural check can produce false positives for events that are intentionally fire-and-forget with no current consumer (e.g., an event added ahead of the context that will eventually consume it). Mitigated by the explicit exemption annotation above, which is itself visible in code review rather than a silent bypass.
- Retrofitting real event consumption is very likely to surface latent correctness bugs in aggregates that were previously only exercised by hand-constructed unit-test inputs (as already happened with the hardcoded From-address string in Contact Graph, issue #40). This is treated as a feature of the retrofit, not a reason to delay it — better to surface these under a controlled rollout than leave them undiscovered indefinitely.

## Alternatives Considered
- **Leave orchestration ad hoc, decided per-PR as contexts happen to need it** — rejected: this is the current state, and it produced six contexts' worth of unused domain code without anyone noticing until an explicit audit was run.
- **Consolidate all cross-context orchestration into one large coordinating service** — rejected: recreates the coupling and single-point-of-failure problems the bounded-context split in `docs/ddd/context-map.md` was designed to avoid; a change to one context's consumption logic should not require touching a shared god-service.
- **Enforce the application-layer requirement only by code-review convention, no CI check** — rejected: convention alone already failed to catch this exact gap across six contexts; a structural CI check is required to keep it fixed.

## Related ADRs
[0001-server-side-middleware-saas-architecture](0001-server-side-middleware-saas-architecture.md), [0003-platform-normalization-layer](0003-platform-normalization-layer.md), [0015-multi-tenancy-data-isolation](0015-multi-tenancy-data-isolation.md), [0020-public-internal-api-design](0020-public-internal-api-design.md), [0023-durable-cross-context-event-backbone](0023-durable-cross-context-event-backbone.md)
