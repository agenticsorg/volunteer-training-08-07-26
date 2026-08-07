# Contact Graph Context

## Purpose / responsibility

Contact Graph determines, per tenant mailbox, which senders are real people the mailbox owner
has a genuine relationship with — the `PersonalContact` category — versus automated/bulk
senders, and separately tracks which of those real people are VIPs. It converges the
multi-signal set research §2.6 lays out: absence of bulk-mail headers, non-`noreply@`-shaped
`From` addresses, presence in the platform People/Contacts API, bidirectional thread history
(sent *to*, not just received *from*), and display-name heuristics — combined as a weighted
score rather than a hard gate, since "no single header is fully reliable" (§2.6: some real
people use role accounts, some automated systems mis-set RFC 3834 headers). It also builds
the interaction-frequency history that Prioritization consumes, and owns VIP promotion —
manually curated by the user and auto-promoted by sustained reply frequency, addressing the
"blind spot" the research flags in static VIP lists alone (§2.5).

## Ubiquitous language

- **Sender Profile** — the per-tenant, per-mailbox aggregate tracking everything known about
  one sending address/domain over time.
- **Contact Classification** — the `Personal | Automated | Unknown` determination for a
  sender, with a confidence score.
- **VIP Designation** — a boolean, per-user flag on a `Sender Profile`, either manually set
  or auto-promoted.
- **Interaction History** — the running count/recency of sent-to and received-from message
  events with a sender, the basis for interaction-frequency scoring.
- **Bidirectionality** — whether the mailbox owner has ever sent mail *to* this address, the
  single strongest personal-contact signal per the research (automated senders essentially
  never receive genuine outbound replies).
- **Automated-Sender Signal** — the weighted bag of bulk-mail evidence (`List-Unsubscribe`,
  `Precedence: bulk`, `Auto-Submitted`, `List-Id`, `noreply@`-shaped local part) that pushes a
  classification toward `Automated`.

## Aggregate roots

### `SenderProfile` (aggregate root)

Identity: `(TenantId, MailboxId, SenderAddressOrDomain)` — tracked per mailbox, not globally,
because "personal contact" is inherently relative to one user's relationships, not a fact
about the sender in the abstract.

Invariants:
- `ContactClassification` is always a weighted composite of signals, never a single hard
  gate — no individual signal (not even bidirectionality) alone forces `Personal` or
  `Automated`, matching the research's explicit caution that no single header is fully
  reliable.
- `VipDesignation` can only be `true` if `ContactClassification` is `Personal` or the VIP
  status was set by explicit manual user action (a user may deliberately VIP a role account,
  e.g. a shared support alias they care about — manual override always wins over the
  automated classifier).
- `InteractionHistory` counters only move forward (append-only event-sourced tally per
  message observed); a `SenderProfile` is never reset except by explicit user data-deletion
  request.
- Auto-promotion to VIP requires a configurable minimum sustained bidirectional interaction
  count within a rolling window, not a single reply — protects against one-off replies
  triggering permanent VIP status.

## Entities and value objects

- `ContactClassification` (value object): `state` (`Personal | Automated | Unknown`),
  `confidence`, `contributingSignals: AutomatedSenderSignal[]`.
- `AutomatedSenderSignal` (value object): `signalType`
  (`ListUnsubscribeHeader | PrecedenceBulk | AutoSubmitted | ListId | NoReplyLocalPart |
  DisplayNameHeuristic`), `present: bool`, `weight`.
- `InteractionEvent` (entity, child of `SenderProfile`): `direction` (`inbound | outbound`),
  `messageId`, `occurredAt` — append-only log backing frequency computation.
- `VipDesignation` (value object): `isVip: bool`, `source` (`manual | autoPromoted`),
  `promotedAt` (nullable).
- `ContactsApiMatch` (value object): whether the sender appears in the platform People/Other
  Contacts results, sourced via each platform's ACL, treated as one signal among several.

## Domain events published

- **`SenderClassified`** — `{ tenantId, mailboxId, senderAddress, classification,
  classifiedAt }`. Triggered on initial classification and on any material re-classification
  (new signal tips the weighted balance). Primary published-language event; consumed by
  Prioritization, Threat Detection, and Mailbox Write-back.
- **`ContactPromotedToVip`** — `{ tenantId, mailboxId, senderAddress, source, promotedAt }`.
  Triggered on manual VIP designation or auto-promotion crossing the interaction threshold.
  Consumed by Prioritization.
- **`InteractionFrequencyUpdated`** — `{ tenantId, mailboxId, senderAddress, frequencyScore,
  windowDays }`. Triggered on a periodic recompute (not per-message, to avoid event storms);
  consumed by Prioritization as a scoring input.

## Repository interfaces (ports)

- `SenderProfileRepository` — load/save by `(TenantId, MailboxId, SenderAddressOrDomain)`.
- `InteractionEventStore` — append-only log per `SenderProfile`, queryable for windowed
  frequency computation.
- `ContactsApiReadPort` — thin read port over the per-platform People/Contacts ACL (below);
  cached, since contacts change far less often than messages arrive.

## Anti-corruption layer notes

`ContactsApiAdapter` (Gmail People API `people.googleapis.com`, and the equivalent
Outlook/Graph contacts endpoint) is isolated behind one `lookupContact(mailboxId, address)`
port. Per research §1.1, Gmail's People API does **not** itself expose an
interaction-frequency score — that must be derived from message history by this context, not
requested from the platform — so the ACL's job here is narrow (existence/match lookup only);
all frequency computation is native domain logic in `InteractionEventStore`, never delegated
to a platform API.

## Relationships to other contexts

- **Downstream of Mailbox Ingestion** — consumes `MessageIngested` (sender address, thread
  direction) to build `InteractionEvent` history and evaluate automated-sender header signals.
- **Upstream of Prioritization** — `SenderClassified` and `ContactPromotedToVip` feed VIP and
  interaction-frequency scoring inputs directly.
- **Upstream of Threat Detection** — correspondence-history facts (has the owner emailed this
  domain before) feed lookalike-domain scoring.
- **Upstream of Mailbox Write-back / Sync** — `SenderClassified` (specifically the
  `PersonalContact` category) is one of the four facet streams Write-back applies.
- **Downstream of Feedback & Learning** — consumes `ContactSignalReinforced` when a user's
  manual correction (e.g., un-VIPing a sender, or moving a message out of "Personal") should
  adjust future classification confidence for that sender.
