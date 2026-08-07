# 0004. Real-time ingestion strategy: webhook push plus mandatory delta-sync backstop

## Status
Accepted

## Date
2026-08-07

## Context
Both platforms offer push notifications, but neither guarantees delivery (research §1.1, §1.2, §5.2):
- **Gmail**: `users.watch()` + Cloud Pub/Sub, rate-limited to ~1 event/sec/user (bursts coalesced), requires `historyId` diff-pull on notify to get actual deltas, and the watch itself **expires every 7 days** and must be renewed.
- **Microsoft Graph**: `/subscriptions` webhooks, Microsoft's own documentation states **no delivery guarantee**, and subscriptions have a max lifetime of ~3 days (~4230 min) requiring renewal.

The research is explicit and unambiguous on this point (research §5.2): "Both require a periodic reconciliation poll/delta-sync as a backstop regardless of webhook use — webhooks are a latency optimization, not a substitute for a periodic full-consistency pass." Relying on webhooks alone risks silently missed messages, which is unacceptable for time-sensitive categories like "needs a reply" and "meeting cancellation" (research §6, open decision #4).

## Decision
Ingestion runs as a **dual-path system**, per tenant mailbox:

1. **Push path (latency optimization)**: Gmail `watch()`+Pub/Sub and Graph `/subscriptions` wake a lightweight handler on new-mail/change events. This handler enqueues a job to fetch the delta since the last known `historyId` (Gmail) or delta token (Graph) — it never trusts the notification payload as a complete description of what changed.
2. **Reconciliation path (correctness guarantee)**: A scheduled delta-sync sweep runs per mailbox on a fixed interval (default: every 5 minutes) using `historyId` diff (Gmail) or `/messages/delta` (Graph), independent of whether any push notification was received. This is the source of truth; the push path only affects how quickly a given message enters the pipeline, never whether it does.
3. **Subscription/watch renewal** is itself a scheduled job (BullMQ delayed job, re-enqueued on execution) — Gmail watches renewed well before their 7-day expiry, Graph subscriptions renewed well before their ~3-day max lifetime. Renewal failures alert on-call (see [[0016-observability-slas-alerting]]) since a silently-expired subscription degrades to reconciliation-only latency without any error surfacing on the platform side.

The reconciliation interval is deliberately tighter than either platform's minimum guarantee window and is tunable per tenant plan tier (see [[0021-usage-metering-billing]]) — see [[0016-observability-slas-alerting]] for how this interval is chosen against the "needs a reply" / "meeting cancellation" latency targets from research §6 open decision #4.

## Consequences

### Positive
- No single point of missed messages: even total webhook failure (subscription expiry, Pub/Sub outage, dropped Graph notification) degrades gracefully to bounded-latency polling rather than silent data loss.
- Matches the research's explicit architectural recommendation rather than a naive "webhooks are real-time, done" design that both platforms' own documentation warns against.

### Negative
- Running both paths means every mailbox generates recurring poll traffic even when webhooks are working perfectly, consuming quota (research §1.1: 250 quota units/user/sec for Gmail; research §1.2: ~10,000 req/10 min/app/mailbox for Graph) that a webhook-only design would not.
- More moving parts to operate: two ingestion code paths, subscription-renewal scheduling, and delta-token/historyId state per mailbox that must never be lost (loss forces a full resync).

### Risks
- If delta-token/historyId state is corrupted or lost for a mailbox, a full resync is required, which is both slow and quota-expensive at scale — mitigated by durable, transactional persistence of sync cursors in Postgres (see [[0002-technology-stack-selection]]) and periodic backup validation (see [[0019-disaster-recovery-business-continuity]]).
- Aggressive reconciliation intervals across many tenants could approach platform-wide throttling ceilings (Graph: 130,000 req/10 sec across all tenants per app — research §1.2); interval and concurrency must scale with tenant count, tracked in [[0017-scalability-queueing-autoscaling]].

## Alternatives Considered
- **Webhook-only ingestion** — rejected outright: contradicts both platforms' own documented delivery guarantees (research §1.1, §1.2) and would silently drop messages, which is disqualifying for a triage product whose value proposition depends on not missing mail.
- **Polling-only (no webhooks)** — rejected: forfeits the latency benefit needed for time-sensitive categories (research §6 open decision #4) without any corresponding simplicity win, since the reconciliation infrastructure must exist regardless.

## Related ADRs
[[0003-platform-normalization-layer]], [[0005-tiered-classification-pipeline]], [[0016-observability-slas-alerting]], [[0017-scalability-queueing-autoscaling]], [[0019-disaster-recovery-business-continuity]]
