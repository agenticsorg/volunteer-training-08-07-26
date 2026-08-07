# Mailbox Write-back / Sync Context

## Purpose / responsibility

Write-back applies the verdicts produced by Classification, Threat Detection, Contact Graph,
and Prioritization back onto the tenant's actual Gmail or Outlook mailbox — as labels on
Gmail, as categories/folder placement/importance on Outlook — per the platform-specific
application strategy in research §6 ("Gmail: labels.modify … don't fight native tabs";
"Outlook: message.categories +/or move to folder + set importance"). It is deliberately a
thin, idempotent application layer: it does not decide *what* a message is, only *how* to
express an already-decided fact on each platform, and it composes four independent upstream
facet streams onto the same message without requiring them to arrive together, since each
facet carries its own latency SLA (research §6, decision #4 — phishing and needs-a-reply are
latency-sensitive; e-commerce/social can lag on the Batch API).

## Ubiquitous language

- **Write-back Task** — one pending platform-side application of a single facet
  (a label, a category set, a folder move, an importance flag) for one message.
- **Platform Application Strategy** — the platform-specific translation rule: Gmail always
  adds labels additively and never fights native tab categories; Outlook sets
  `categories[]` additively and may additionally move the message to a folder or set
  `importance`, per tenant configuration.
- **Idempotent Apply** — the property that reapplying the same facet twice (e.g., after a
  retry) produces no duplicate labels/categories and no observable side effect beyond the
  first successful application.
- **Divergence** — a mismatch discovered between what Write-back last applied and what the
  platform currently shows for a message (the passive-correction signal Feedback & Learning
  consumes).

## Aggregate roots

### `MessageWriteBackState` (aggregate root)

Identity: `(TenantId, MailboxId, MessageId)`.

Invariants:
- Tracks, per facet type (`Category` from Classification, `Threat` from Threat Detection,
  `Contact` from Contact Graph, `Priority` from Prioritization), the last-applied value and
  the platform write status (`Pending | Applied | Failed`) — facets are applied and tracked
  independently; a failure or delay in one facet never blocks applying another.
- Apply operations are idempotent by construction: before issuing a platform write, the
  aggregate compares the desired state (from the upstream event) against
  `lastKnownPlatformState`; a no-op desired state issues no API call.
- A `Quarantine` decision (from Threat Detection) takes precedence over normal label
  application for that message — while `Quarantine` is active, other facets may still be
  recorded but their platform-visible application (e.g., moving to a visible "Sales" label)
  is suppressed per tenant policy, so a quarantined message isn't simultaneously routed into
  a normal-looking folder.
- Detecting a `Divergence` does not mutate this aggregate's own state destructively — it
  raises `WriteBackDivergenceDetected` and defers interpretation entirely to Feedback &
  Learning; Write-back does not attempt to guess whether a divergence was a correction or an
  unrelated user action.

## Entities and value objects

- `FacetApplication` (entity, child of `MessageWriteBackState`): `facetType`, `desiredValue`,
  `lastKnownPlatformState`, `status`, `lastAttemptAt`, `retryCount`.
- `PlatformApplicationStrategy` (value object, per-tenant configuration): e.g., whether
  Outlook write-back moves messages to folders or only sets categories (a tenant-level UX
  choice, since folder moves are more disruptive than additive categories).
- `WriteBackFailureReason` (value object): `rateLimited | authRevoked | messageDeleted |
  platformError`.

## Domain events published

- **`FacetAppliedToPlatform`** — `{ tenantId, mailboxId, messageId, facetType, platform,
  appliedAt }`. Triggered on each successful platform write; primarily for audit/observability
  and for Tenant & Subscription's write-volume usage metering.
- **`WriteBackFailed`** — `{ tenantId, mailboxId, messageId, facetType, reason,
  retryCount }`. Triggered on a failed apply after backoff/retry policy is exhausted for the
  current attempt window; drives operational alerting distinct from user-facing notifications.
- **`WriteBackDivergenceDetected`** — `{ tenantId, mailboxId, messageId, facetType,
  expectedState, observedState, observedAt }`. Triggered when a subsequent Mailbox Ingestion
  sync shows the platform state no longer matches what Write-back last applied. The sole
  input Feedback & Learning uses to infer passive corrections.

## Repository interfaces (ports)

- `MessageWriteBackStateRepository` — load/save by `(TenantId, MailboxId, MessageId)`.
- `WriteBackTaskQueue` — durable, retryable task queue per facet application, so a slow or
  failing platform call for one facet doesn't block others.
- `PlatformApplicationStrategyRepository` — per-tenant configuration store.

## Anti-corruption layer notes

Two adapters — `GmailWriteBackAdapter` and `OutlookWriteBackAdapter` — implement one
`MailboxWritePort` (`applyFacet(mailboxId, messageId, facet, desiredValue)`):

| Facet | Gmail translation | Outlook translation |
|---|---|---|
| Category labels (Newsletter, JobPosting, Social, Ecommerce, SalesAndDeals, LinkedIn, MeetingCancellation) | `users.labels` + `messages.modify` to add a label; never removes/overrides Gmail's own `CATEGORY_*` system labels | Add to `message.categories[]`; optionally move to a mapped folder per `PlatformApplicationStrategy` |
| `NeedsReply` | Custom label add | Custom category add; optionally leaves in Focused Inbox rather than moving |
| `PhishingAttempt` / `Quarantine` | Label add; on `Quarantine`, optionally applies a Gmail filter action equivalent (never uses `mail.google.com`-scope delete/spam-move given the scope-minimization stance in research §5.4) | Category add; on `Quarantine`, optional move to a dedicated review folder |
| `PersonalContact` | Label add | Category add |
| `PriorityTier` | Label add (no native importance concept) | Category add **and** sets `importance` property, since Outlook has a first-class importance field Gmail lacks |

This table is exactly the kind of platform-quirk isolation the research calls for (§ purpose
statement: "anti-corruption layer isolating platform-specific quirks — labels vs. folders").
Rate-limit handling (Gmail 250 units/user/sec moving average; Outlook 10k req/10min per
mailbox, `Retry-After` on 429) is implemented per-adapter behind the same port signature, so
the aggregate and task queue never see platform-specific throttling types.

## Relationships to other contexts

- **Downstream of Classification, Threat Detection, Contact Graph, and Prioritization** —
  pure fan-in consumer of `MessageClassified`, `MessageThreatAssessed`, `SenderClassified`,
  and `MessagePrioritized`; conformist to each — it never reinterprets or second-guesses an
  upstream verdict, only translates and applies it.
- **Downstream of Mailbox Ingestion** — needs current `lastKnownPlatformState` and mailbox
  credentials context (indirectly, via Ingestion's `MailboxConnection`) to issue writes.
- **Upstream of Feedback & Learning** — `WriteBackDivergenceDetected` is the mechanism by
  which passive corrections enter the system.
- **Upstream of Tenant & Subscription** — `FacetAppliedToPlatform` volume feeds write-side
  usage metering (relevant where platform write quota, not just read/classify volume, is
  plan-limited).
