# 0023. Durable cross-context event backbone (transactional outbox + queue-backed delivery)

## Status
Accepted

## Date
2026-08-21

## Context
[0004-real-time-ingestion-with-delta-sync-backstop](0004-real-time-ingestion-with-delta-sync-backstop.md) and [0006-multi-label-classification-data-model](0006-multi-label-classification-data-model.md) both assume `MessageIngested` and the classification/threat/contact/priority events downstream of it are published durably and consumed reliably — the whole system, per `docs/ddd/context-map.md`, is event-driven fan-out from `MessageIngested`. A post-implementation audit of the running codebase found this fan-out does not exist: all 10 bounded-context modules register on a shared NestJS `EventEmitterModule`, but a repo-wide grep for `@OnEvent` returns zero listeners. A Gmail webhook flows through `WebhooksController` → `WebhookWorker` → emits `mailbox.delta-sync-requested`, and the chain stops there — no delta-fetch job runs, `MessageIngested` is never actually published, and every downstream context that depends on it (Classification, Contact Graph, Threat Detection, and transitively Prioritization, Write-back, Feedback & Learning, Notification & Alerting) never fires in the running system. This is tracked as GitHub issue #30, and is the single highest-leverage gap identified in the audit.

The root cause is architectural, not a missing handful of call sites: there is no durable delivery mechanism between "a context publishes a domain event" and "another context's application layer reacts to it." In-process `EventEmitter2.emit()` calls are non-durable (lost on crash, not retried, not visible across process boundaries) and were never intended by [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md) as the cross-context integration mechanism — that ADR specifies BullMQ/Redis queues for exactly this kind of durable, retryable work, but the queue topology it describes was never extended to carry domain events between contexts.

## Decision
- **Transactional outbox on every aggregate that publishes a domain event.** When a bounded context's command handler commits a state change that raises a domain event (`MessageIngested`, `MessageClassified`, `SenderClassified`, `MessageThreatAssessed`, `MessagePrioritized`, `FacetAppliedToPlatform`, etc.), the event row is written to a shared `domain_event_outbox` table in the **same database transaction** as the aggregate's state change. This extends the outbox requirement already specified for `MessageIngested` in the Stage 3 implementation prompt to all 10 contexts uniformly, rather than leaving it as a single-context special case.
- **A dedicated outbox-relay worker** polls unpublished `domain_event_outbox` rows (ordered, batched, tenant-scoped per [0015-multi-tenancy-data-isolation](0015-multi-tenancy-data-isolation.md)) and publishes them onto durable BullMQ queues — one queue per (publishing context, event type) pair, extending the queue topology established in [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md) rather than introducing a second queueing mechanism.
- **In-process `EventEmitter2` is retained only for same-process, same-transaction side effects that are acceptable to lose on crash** (e.g., local cache invalidation) — it is explicitly disallowed as the mechanism for cross-context integration going forward.
- **Delivery semantics are at-least-once**, with consumer-side idempotency keyed on `(eventId, consumerName)`, consistent with the idempotency requirements already specified for `MessageIngested` (idempotent per `(MailboxId, PlatformMessageRef)`) and `FacetAppliedToPlatform` (idempotent-apply) elsewhere in the plan.
- **No cross-event ordering guarantee** is provided by the backbone itself; consumers must be commutative/idempotent per aggregate id. This is consistent with [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md)'s existing revisit-trigger reasoning — a log-based broker with stronger ordering guarantees (e.g., Kafka) remains a considered future option if a genuine ordering requirement emerges, not a day-one requirement.
- **CI gate**: a new check fails the build if a context publishes an event class with no registered outbox-relay routing entry — i.e., an event that exists in code but has no path to ever leave the process. This is the publish-side half of closing the gap; the consume-side half (an event with no listener) is addressed in [0024-application-layer-orchestration-mandate](0024-application-layer-orchestration-mandate.md).

## Consequences

### Positive
- Unblocks the entire event-driven architecture the implementation plan and `context-map.md` assume: once this exists, `MessageIngested` can actually reach Classification/Contact Graph/Threat Detection, and their outputs can actually reach Prioritization/Write-back/Feedback/Notification.
- Durable, retryable delivery survives process restarts and worker crashes, unlike the current in-process `EventEmitter2` wiring.
- Produces an auditable event log (the outbox table itself) useful for debugging classification-pipeline issues and for the shadow-evaluation traffic sampling described in [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md).

### Negative
- Adds real infrastructure (outbox table, relay worker, per-event-type queues) and an inherent publish-to-consume latency (poll/batch interval) versus the instantaneous — but unreliable — in-process emit it replaces.
- Every context's write path now has an additional table write per published event; this must be accounted for in the transaction and index design, especially for high-volume events like `MessageIngested`.

### Risks
- The outbox-relay worker is a new single-purpose component; if under-scaled it becomes a backlog point for every context in the system simultaneously. Mitigated by applying the same criticality-tiered autoscaling policy from [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md) to the relay worker pool itself.
- At-least-once delivery means every consumer must be genuinely idempotent; a consumer that assumes at-most-once delivery will double-apply effects. Mitigated by the idempotency-key requirement above and by the aggregate-level idempotent-apply patterns already specified for Mailbox Ingestion and Write-back.

## Alternatives Considered
- **Keep pure in-process `EventEmitter2` for cross-context wiring** — rejected: this is the current state, is not durable, does not survive process restart or crash, and is the direct cause of the fan-out failure this ADR exists to fix.
- **Direct synchronous service-to-service calls between contexts instead of events** — rejected: violates the bounded-context/published-language architecture in `docs/ddd/context-map.md`, creates tight coupling between contexts the plan deliberately kept independent, and turns a single slow downstream context into a cascading failure for every context that calls it synchronously.
- **Kafka or another log-based broker from day one** — rejected for the same reasons [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md) already rejected it for v1: operational overhead disproportionate to current scale. The explicit revisit trigger in that ADR still applies; this decision does not change it.

## Related ADRs
[0004-real-time-ingestion-with-delta-sync-backstop](0004-real-time-ingestion-with-delta-sync-backstop.md), [0006-multi-label-classification-data-model](0006-multi-label-classification-data-model.md), [0015-multi-tenancy-data-isolation](0015-multi-tenancy-data-isolation.md), [0016-observability-slas-alerting](0016-observability-slas-alerting.md), [0017-scalability-queueing-autoscaling](0017-scalability-queueing-autoscaling.md), [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md), [0024-application-layer-orchestration-mandate](0024-application-layer-orchestration-mandate.md)
