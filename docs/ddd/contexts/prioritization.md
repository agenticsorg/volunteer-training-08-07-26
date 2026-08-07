# Prioritization Context

## Purpose / responsibility

Prioritization computes a 0–100 urgency/priority score per message from the composite signal
set identified in research §2.5: VIP-list membership, historical interaction frequency,
content-based urgency language, calendar proximity, and the `NeedsReply` flag itself
(unanswered + aging escalates). It exists specifically to correct the "known blind spot" the
research calls out in pure VIP-list approaches — treating every VIP message identically
regardless of content, and missing brand-new important senders who aren't yet listed — by
combining a static/dynamic VIP list with content-aware signals rather than relying on either
alone. Its output is a distinct, independently-published facet (`PriorityTier`), not a field
bolted onto Classification's result, because it depends on inputs (VIP status, interaction
history) that live in another context entirely.

## Ubiquitous language

- **Priority Score** — an integer 0–100 computed per message per the weighted signal set
  below.
- **Priority Tier** — a coarser bucket derived from the score for UI/write-back purposes
  (e.g., `Critical | High | Normal | Low`); the score is the source of truth, the tier is a
  presentation-friendly projection.
- **VIP Designation** — a per-tenant, per-user flag on a sender (manually curated or
  auto-promoted), sourced from Contact Graph, not owned here.
- **Interaction Frequency** — how often the mailbox owner has replied to this sender
  historically; sourced from Contact Graph.
- **Urgency Language Signal** — content-derived score component (deadline words, imperative
  phrasing, LLM judgment on framing).
- **Calendar Proximity Signal** — whether the message references a meeting/event occurring
  within a configurable near-term window.
- **Scoring Weights** — the per-tenant-configurable weighting of the four+ signal components;
  research explicitly flags the "4-signal, 0–100" formula as one vendor's plausible pattern,
  not a proven standard, so weights are a first-class configurable value, not a hardcoded
  constant.

## Aggregate roots

### `MessagePriority` (aggregate root)

Identity: `(TenantId, MessageId)`.

Invariants:
- A score is only computable once the message has at least a `MessageClassified` fact
  available (the `NeedsReply` input is mandatory context, not optional) — scoring a message
  before classification has run is disallowed; the aggregate stays in a `PendingSignals`
  state until its required inputs arrive.
- Score is always in `[0, 100]`; each contributing `ScoreComponent` is independently bounded
  and auditable (sum-and-clamp, not an opaque model output), so a support engineer can explain
  why a score is what it is — this traceability was an explicit design goal given the
  research's caution that the exact formula is unproven and will need tenant-side tuning.
- Re-scoring is idempotent given the same inputs (VIP status, interaction frequency,
  classification facts, calendar signal) — replays produce the same score, so the aggregate
  can be safely recomputed when any one upstream signal changes (e.g., a sender is newly
  promoted to VIP) without needing to diff against prior state.
- `NeedsReply` aging (unanswered past a configurable threshold) monotonically increases the
  score on recompute; it never decreases score on its own — de-escalation only happens
  because the message was answered (removing `NeedsReply`) or an explicit correction.

## Entities and value objects

- `ScoreComponent` (value object): `signal` (`VipList | InteractionFrequency |
  UrgencyLanguage | CalendarProximity | NeedsReplyAging`), `contribution` (signed integer),
  `evidence`.
- `ScoringWeights` (value object, per-tenant configuration): weight per `signal` type; default
  weights ship as a sane baseline, tenants may override.
- `PriorityRecomputeTrigger` (value object): `newMessage | vipStatusChanged |
  interactionFrequencyChanged | needsReplyAgedPastThreshold | userCorrection` — records *why*
  a recompute happened, for audit and for avoiding redundant recompute storms.

## Domain events published

- **`MessagePrioritized`** — `{ tenantId, messageId, score, tier, components:
  ScoreComponent[], scoringWeightsVersion, computedAt }`. Triggered whenever a score is
  (re)computed. Consumed by Mailbox Write-back (to set Outlook `importance` / apply a
  priority label/category) and Notification & Alerting.
- **`MessagePriorityEscalated`** — `{ tenantId, messageId, previousTier, newTier, reason }`.
  Triggered specifically when a tier crosses upward into `High`/`Critical` — a narrower,
  higher-signal event than every recompute, so Notification & Alerting can subscribe to just
  the escalations that warrant interrupting the user rather than every score tick.

## Repository interfaces (ports)

- `MessagePriorityRepository` — load/save by `(TenantId, MessageId)`.
- `ScoringWeightsRepository` — per-tenant weight configuration, read at recompute time,
  writable via tenant admin settings.
- `PriorityInputsReadModel` (port) — a read-only, eventually-consistent projection this
  context maintains from `MessageClassified`, `SenderClassified`,
  `ContactPromotedToVip` events, so scoring doesn't synchronously call out to Classification
  or Contact Graph on every computation.

## Anti-corruption layer notes

Prioritization touches no external platform API directly — calendar proximity is derived from
signals already normalized into the `MessageEnvelope` by Mailbox Ingestion (meeting
references, `text/calendar` parts) rather than a fresh Graph/Gmail Calendar API call, keeping
this context free of platform-specific ACL concerns. Where urgency-language scoring uses an
LLM judgment (research §2.5 treats this as one input, cheaper than Threat Detection's deeper
BEC reasoning), it goes through the same `ClassifierPort` abstraction defined in the
Classification context rather than a second bespoke LLM integration — Prioritization is a
*consumer* of that port, not a second owner of LLM-provider ACL logic.

## Relationships to other contexts

- **Downstream of Classification** — consumes `MessageClassified` for the `NeedsReply` signal
  and category context (needs-reply aging is itself a scoring input).
- **Downstream of Contact Graph** — consumes `SenderClassified` and
  `ContactPromotedToVip` for VIP designation and interaction frequency.
- **Downstream of Tenant & Subscription** (conformist) — reads plan entitlements for whether
  a tenant may customize `ScoringWeights` (a higher-tier feature) versus using system
  defaults.
- **Upstream of Mailbox Write-back / Sync** — `MessagePrioritized` is one of the four facet
  streams Write-back applies to the platform message.
- **Upstream of Notification & Alerting** — `MessagePriorityEscalated` drives urgent alerts.
