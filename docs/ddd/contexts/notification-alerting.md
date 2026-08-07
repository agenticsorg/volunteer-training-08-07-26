# Notification & Alerting Context

## Purpose / responsibility

Notification & Alerting turns other contexts' published verdicts into user-facing signals:
periodic digests (a rundown of what got sorted where) and escalating, interruptive alerts for
the situations research §6's open decision #4 calls out as having real staleness cost — an
aging, unanswered `NeedsReply` message, an urgent `MessageQuarantined` phishing flag, and a
`MessagePriorityEscalated` crossing into `Critical`. It adds no classification, scoring, or
threat logic of its own; it is a pure downstream renderer/aggregator over four upstream event
streams, deciding only *when*, *how urgently*, and *through which channel* to surface an
already-decided fact — deliberately not notifying the user by delivering another email for an
inbox-triage-fatigue product, so channel selection (push, SMS, in-app, or a digest email
through a distinct outbound sending path) is a first-class concern here.

## Ubiquitous language

- **Alert** — a single, immediate, interruptive notification tied to one triggering event
  (quarantine, priority escalation, needs-reply aging past threshold).
- **Digest** — a periodic (e.g., daily) rollup summarizing lower-urgency activity across a
  mailbox: counts and highlights by category, not immediate per-message pushes.
- **Escalation Threshold** — the per-tenant-configurable point at which a `NeedsReply`
  message's age converts a routine fact into an `Alert` (research §6, decision #4's example:
  a <2 min SLA target shapes whether this can be push-driven alone or needs tighter polling
  backstop upstream — this context only consumes the resulting event, it does not itself
  poll).
- **Notification Channel** — the delivery mechanism (`Push | Sms | InApp | DigestEmail`),
  authorized per user via Identity & Access.
- **Notification Preference** — per-user configuration of which event types produce an
  `Alert` versus are folded into the next `Digest` only.

## Aggregate roots

### `NotificationSubscription` (aggregate root)

Identity: `(TenantId, UserId)`.

Invariants:
- Every alert-eligible event type (`MessageQuarantined`, `MessagePriorityEscalated`,
  `NeedsReplyAgingThresholdCrossed`) has an explicit per-user `NotificationPreference`
  entry — there is no implicit "notify by default for everything" state; a fresh
  `NotificationSubscription` starts with safe, non-spammy defaults (phishing alerts on,
  digest for the rest) that the user can widen or narrow.
- A `NotificationChannel` can only be used if `Identity & Access` reports it as authorized
  for that user (e.g., a phone number verified for SMS) — this aggregate never sends to an
  unverified channel, even if a preference nominally selects it.
- Digest generation is idempotent per `(TenantId, UserId, BillingPeriod-independent digest
  window)` — a retried digest job never double-sends.

### `AlertDispatch` (aggregate root)

Identity: internally minted `AlertId`, referencing the triggering upstream event.

Invariants:
- Rate-limited per user per triggering category within a cool-down window (e.g., no more than
  one `MessagePriorityEscalated` alert per sender within N minutes) — prevents a burst of
  related upstream events (several urgent messages from the same VIP in quick succession)
  from becoming an alert storm that trains the user to ignore alerts.
- Once `Dispatched`, an `AlertDispatch` is immutable; a correction to the underlying verdict
  (e.g., `QuarantineOverridden`) produces a new, distinct `AlertRetracted`-style follow-up
  notification rather than mutating the original record.

## Entities and value objects

- `NotificationPreference` (entity, child of `NotificationSubscription`): `eventType`,
  `deliveryMode` (`Immediate | DigestOnly | Off`), `preferredChannel`.
- `DigestWindow` (value object): `windowStart`, `windowEnd`, `cadence` (`daily | weekly`,
  tenant/plan-configurable per `Entitlement.DigestFrequency`).
- `AlertPayload` (value object): `triggeringEvent`, `renderedSummary` (short, human-readable,
  never the raw email body — respects the same content-minimization stance as elsewhere in
  the system), `severity`.

## Domain events published

- **`AlertDispatched`** — `{ tenantId, userId, alertId, channel, eventType, dispatchedAt }`.
  Consumed by Tenant & Subscription for usage metering (alert volume may be plan-limited) and
  for internal delivery-observability.
- **`DigestGenerated`** — `{ tenantId, userId, digestWindow, itemCounts (`by category),
  generatedAt }`. Consumed by Tenant & Subscription for digest-send usage metering.
- **`NotificationDeliveryFailed`** — `{ tenantId, userId, channel, reason }`. Triggered on a
  failed send (invalid channel, provider outage); drives operational retry/fallback-channel
  logic, not a user-facing signal itself.

## Repository interfaces (ports)

- `NotificationSubscriptionRepository` — load/save by `(TenantId, UserId)`.
- `AlertDispatchRepository` — load/save by `AlertId`; queryable by user + time window for
  cool-down rate-limiting checks.
- `DigestScheduleReadModel` (port) — a maintained projection of pending digest windows per
  user, driven by `DigestWindow.cadence`, so digest generation is a scheduled sweep rather
  than a per-event trigger.

## Anti-corruption layer notes

`NotificationDeliveryAdapter` isolates outbound delivery providers (push-notification
service, SMS gateway, transactional email sender for digests) behind one
`NotificationDeliveryPort` (`send(channel, payload)`), translating each provider's distinct
API/webhook shape and delivery-status semantics into this context's own `Dispatched | Failed`
outcome. Digest email delivery specifically goes through a transactional-email path entirely
separate from the tenant's own Gmail/Outlook mailbox (never sent *through* the very mailbox
being triaged), avoiding the circularity of notifying about email congestion by adding to it.

## Relationships to other contexts

- **Downstream of Threat Detection** — `MessageQuarantined` is the highest-severity alert
  trigger in the system.
- **Downstream of Classification** — aging `NeedsReply` messages drive
  `NeedsReplyAgingThresholdCrossed`-derived alerts (computed here from `MessageClassified`
  timestamps against the configurable `EscalationThreshold`, since Classification itself has
  no notion of "how long has this sat unanswered").
- **Downstream of Prioritization** — `MessagePriorityEscalated` drives high-priority alerts.
- **Downstream of Identity & Access** (conformist) — reads authorized notification channels
  per user; never sends to a channel Identity & Access hasn't vouched for.
- **Downstream of Tenant & Subscription** (conformist) — reads `Entitlement.DigestFrequency`
  to determine digest cadence eligibility per plan.
- **Upstream of Tenant & Subscription** — `AlertDispatched`/`DigestGenerated` are
  usage-metering source events.
