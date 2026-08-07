# Mailbox Ingestion Context

## Purpose / responsibility

Mailbox Ingestion is the sole point of contact between the system and each tenant's connected
Gmail and/or Outlook mailboxes. It establishes and maintains platform sync mechanisms (Gmail
`watch()` + Pub/Sub, Outlook `/subscriptions` webhooks), reconciles them against periodic
delta/history pulls because neither platform guarantees webhook delivery (research §5.2), and
normalizes every inbound message — regardless of source platform — into one canonical
`MessageEnvelope` shape that every downstream context can consume without ever touching a
Gmail or Graph SDK. It owns nothing about *what a message means*; it only owns getting the
message, and the fact of its arrival, reliably and exactly-once into the system.

## Ubiquitous language

- **Mailbox Connection** — a tenant user's authorization to sync one platform mailbox.
- **Watch Subscription** — the platform-side registration (Gmail `watch()`, Graph
  `/subscriptions`) that triggers push notifications; has an expiry and must be renewed.
- **Sync Cursor** — the resumption point for a reconciliation pull: Gmail `historyId` or
  Graph `deltaLink`.
- **Reconciliation Sweep** — a periodic delta pull run regardless of whether a webhook fired,
  the backstop against missed push notifications.
- **Message Envelope** — the normalized, platform-agnostic representation of one message:
  headers, thread/conversation linkage, body reference, attachment metadata.
- **Platform Message Ref** — the tuple of platform + platform-native message ID + thread ID,
  kept for write-back addressing but never leaked past the ACL.

## Aggregate roots

### `MailboxConnection` (aggregate root)

Identity: `(TenantId, MailboxId)`.

Invariants:
- At most one **active** Watch Subscription exists per `(MailboxId, Platform)` at a time.
- `SyncCursor` only moves forward; a reconciliation sweep that would move it backward is
  rejected (protects against replaying already-ingested messages).
- No sync attempt is made while the connection's credential status (mirrored read-only from
  Identity & Access) is `revoked` or `expired` — ingestion halts and raises
  `MailboxConnectionSyncBlocked` rather than retrying indefinitely.
- A connection's `Platform` (Gmail | Outlook) is immutable after creation; reconnecting a
  different platform account requires a new `MailboxConnection`.

### `IngestedMessage` (aggregate root)

Identity: `(TenantId, MessageId)` where `MessageId` is an internally minted UUID, distinct
from the platform-native ID, so downstream contexts never need to know which platform a
message came from.

Invariants:
- Normalization is idempotent: the same `(MailboxId, PlatformMessageRef)` always resolves to
  the same `MessageId` (deduplicates redelivered webhooks and overlapping reconciliation
  sweeps).
- An `IngestedMessage` is immutable once created — platform-side edits (rare, e.g. a draft)
  produce a new envelope version rather than mutating history that downstream classification
  events may already reference.

## Entities and value objects

- `WatchSubscription` (entity, child of `MailboxConnection`): `subscriptionId`, `platform`,
  `expiresAt`, `renewalAttempts`.
- `SyncCursor` (value object): tagged union `GmailHistoryId(string) | GraphDeltaLink(url)`.
- `MessageEnvelope` (value object): `platform`, `platformMessageRef`, `threadRef`
  (`Gmail threadId` / `Graph conversationId`), `from`, `to`, `subject`, `sentAt`,
  `headerBag` (raw header name→value, preserved for downstream rule evaluation — see
  Classification's use of `List-Unsubscribe`, `DMARC`, etc.), `bodyRef` (pointer into
  content storage, not inline — see Security note below), `hasCalendarPart: bool`,
  `attachmentSummaries: []`.
- `PlatformMessageRef` (value object): `platform`, `nativeMessageId`, `nativeThreadId`.
- `CredentialStatus` (value object, read-only projection from Identity & Access): `active |
  expiring | revoked`.

## Domain events published

- **`MessageIngested`** — `{ tenantId, mailboxId, messageId, platform, threadRef, envelope,
  ingestedAt }`. Triggered on successful normalization of a new, previously-unseen message.
  This is the system's primary published-language event; Classification, Threat Detection,
  and Contact Graph all subscribe.
- **`MailboxSyncFailed`** — `{ tenantId, mailboxId, platform, reason, occurredAt }`. Triggered
  when a reconciliation sweep or webhook-triggered pull errors (auth failure, quota
  exhaustion/HTTP 429, transient platform outage).
- **`WatchSubscriptionExpiringSoon`** — `{ tenantId, mailboxId, platform, expiresAt }`.
  Triggered by a scheduled check inside the renewal window (Gmail: 7-day watch lifetime;
  Graph: ~3-day subscription lifetime, per research §1).
- **`MailboxConnectionRevoked`** — `{ tenantId, mailboxId, platform, revokedAt }`. Triggered
  when Identity & Access reports the credential is no longer usable; halts further sync
  attempts against this mailbox.

## Repository interfaces (ports)

- `MailboxConnectionRepository` — load/save by `(TenantId, MailboxId)`; query all connections
  due for watch renewal.
- `IngestedMessageRepository` — idempotent upsert keyed by `(MailboxId, PlatformMessageRef)`;
  read by `MessageId`.
- `SyncCursorStore` — get/advance cursor per `MailboxConnection`, with optimistic concurrency
  to prevent two concurrent sweeps from racing.
- `MessageEventOutbox` — transactional outbox for `MessageIngested` and sibling events, so
  publication is atomic with the ingestion write (at-least-once delivery to the event bus,
  deduplicated downstream by `MessageId`).

## Anti-corruption layer notes

Ingestion is the highest-surface-area ACL boundary in the system because Gmail and Outlook
disagree on nearly every primitive:

| Concern | Gmail | Outlook (Graph) | ACL responsibility |
|---|---|---|---|
| Organization primitive | Labels (multi-valued) + system categories | Folders (single location) + `categories[]` | Normalize into `MessageEnvelope` without assuming either model; write-back (a separate context) re-specializes per platform. |
| Change notification | `watch()` + Pub/Sub, ~1 evt/sec/user, requires `historyId` diff pull | `/subscriptions` webhook, explicitly no delivery guarantee | Both are treated as *hints to sync now*, never as the source of truth — the reconciliation sweep is authoritative in both adapters. |
| Renewal cadence | 7 days | ~3 days (varies by resource) | `WatchSubscription.expiresAt` is platform-reported; the renewal scheduler is platform-agnostic. |
| Throttling | 250 quota units/user/sec (moving average) | 10,000 req/10 min per app per mailbox; 429 + `Retry-After` | Each platform adapter implements its own backoff/jitter behind a common `MailboxSyncPort.pull()` signature; callers never see platform-specific rate-limit types. |
| Body/attachment shape | MIME parts via `messages.get` | MIME/`body` resource via Graph | Both map into the same `MessageEnvelope.bodyRef` + `attachmentSummaries` shape; raw MIME parsing (e.g., detecting `text/calendar; method=CANCEL`) happens inside the adapter so downstream contexts only see a normalized `hasCalendarPart` flag and a typed calendar-method field, not raw MIME. |

Two adapters — `GmailIngestionAdapter` and `OutlookIngestionAdapter` — implement one
`MailboxSyncPort` interface (`establishWatch`, `renewWatch`, `pullDelta`,
`fetchMessage`). Nothing above the port knows which platform it's talking to.

**Security note**: per research §5.4, full message bodies are high-sensitivity. `bodyRef`
points at a short-retention content store rather than embedding body text in the envelope
itself, so `MessageIngested` payloads (which cross context/event-bus boundaries and may be
logged) don't carry raw email content by default.

## Relationships to other contexts

- **Downstream of Identity & Access** — consumes `AuthorizedMailboxAccess` (credential
  issuance) and `CredentialRevoked` to gate sync attempts.
- **Downstream of Tenant & Subscription** (conformist) — reads `PlanEntitlements` (mailbox
  count limits, sync-frequency tier) without negotiating their shape.
- **Upstream of Classification, Threat Detection, and Contact Graph** — publishes
  `MessageIngested` as the published-language entry point for all content-driven analysis.
- **Upstream of Tenant & Subscription** — emits sync volume as a usage-metering signal
  (messages ingested per tenant per billing period).
