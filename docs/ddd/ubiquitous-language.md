# Ubiquitous Language

Cross-context glossary for the Cross-Platform Email Triage & Classification System. Terms
scoped to a single bounded context are defined in that context's own file
(`docs/ddd/contexts/*.md`) and are not repeated here unless another context also needs to
reference them precisely. Where a term's precise shape is owned by one context and merely
*referenced* by others, the owner is noted — downstream contexts must not redefine it.

## Identity & partitioning

- **TenantId** — the mandatory partition key for every aggregate in the system; owned by
  [Tenant & Subscription](contexts/tenant-subscription.md) (commercial facts) and mirrored as
  an identity concept in [Identity & Access](contexts/identity-access.md). No aggregate,
  repository, or event in the system omits it.
- **UserId** — a human account under a `Tenant`, owned by Identity & Access.
- **MailboxId** — one connected platform mailbox (Gmail or Outlook account) belonging to a
  `User`, owned by Identity & Access (as `MailboxAuthorization`) and referenced by Mailbox
  Ingestion (as `MailboxConnection`).
- **MessageId** — the internally minted, platform-agnostic identifier for one message, minted
  by [Mailbox Ingestion](contexts/mailbox-ingestion.md) and used as the join key by every
  downstream context (Classification, Threat Detection, Contact Graph, Prioritization,
  Write-back). Never the same value as a Gmail or Graph native message ID.
- **Platform** — `Gmail | Outlook`, the two supported mailbox providers.

## The message envelope

- **Message Envelope** — the normalized, platform-agnostic shape of one message (headers,
  thread linkage, body reference, calendar/attachment flags), owned by Mailbox Ingestion.
  Every other context consumes this shape, never a raw Gmail/Graph API response.
- **Thread Ref** — the platform-native conversation identifier (Gmail `threadId` / Graph
  `conversationId`), preserved through normalization because thread-state is a first-class
  rule signal (see Needs Reply, below).
- **Platform Message Ref** — the (platform, native message ID, native thread ID) tuple kept
  for write-back addressing; never exposed past Mailbox Ingestion's and Mailbox Write-back's
  anti-corruption layers.

## The taxonomy

- **Category** — one of the fixed 11 labels the whole system exists to assign, owned as an
  enum by [Classification](contexts/classification.md):
  `Newsletter`, `JobPosting`, `Social`, `Ecommerce`, `SalesAndDeals`, `LinkedIn`,
  `MeetingCancellation`, `NeedsReply`, `PhishingAttempt`, `PersonalContact`, `PriorityTier`.
  Classification directly computes the first eight (through its rules→LLM pipeline);
  `PhishingAttempt` is computed by Threat Detection, `PersonalContact` by Contact Graph, and
  `PriorityTier` (a score-derived bucket) by Prioritization — all four contexts publish their
  facet independently and Mailbox Write-back composes them onto the same message. See
  [context-map.md](context-map.md) for why this is choreography, not one shared aggregate.
- **Multi-label** — the confirmed design constraint (research report §6, open decision #2)
  that a single message may carry several `Category` values simultaneously (e.g., e-commerce
  *and* needs-a-reply *and* high-priority at once). No context in this system models a
  single-label "the category" field.
- **Label Assignment** — one `(Category, confidence, sourceTier, evidence)` tuple; the unit
  Classification's result set is composed of. Owned by Classification.
- **Confidence Score** — a 0.0–1.0 value attached to a label assignment or threat/contact
  verdict, always paired with enough evidence to be explainable, never an opaque number alone.
- **Classification Tier** — the rules→LLM escalation ladder (`Rule | CheapLlm | FrontierLlm`)
  from research §2.3's "cheap-first, LLM-as-fallback" pattern. Classification and Threat
  Detection each maintain their own tier state (different escalation triggers), but share the
  same underlying `ClassifierPort` abstraction for LLM calls.
- **Taxonomy Version** — the version marker tying a classification result to the exact
  category definitions and few-shot set that produced it; owned by Classification, bumped by
  Feedback & Learning.

## Priority, threat, and contact facets

- **Priority Score / Priority Tier** — the 0–100 urgency score and its derived bucket, owned
  by [Prioritization](contexts/prioritization.md); computed from VIP status, interaction
  frequency, content urgency, calendar proximity, and `NeedsReply` aging (research §2.5).
- **Needs Reply** — both a `Category` value (computed by Classification via thread-state +
  content signals, research §2.4) and, once assigned, an input to Prioritization's scoring
  and to Notification & Alerting's aging-escalation logic. The single highest-precision
  underlying heuristic is thread-state: the mailbox owner is not the last sender on the
  thread (works identically on Gmail `threadId` and Outlook `conversationId`).
- **VIP Designation** — a per-user, per-sender flag owned by
  [Contact Graph](contexts/contact-graph.md); manually set or auto-promoted from sustained
  interaction frequency. Referenced, not recomputed, by Prioritization.
- **Sender Classification / Contact Classification** — the `Personal | Automated | Unknown`
  determination for a sender, owned by Contact Graph.
- **Threat Assessment / Quarantine Decision** — the phishing/BEC verdict and enforcement
  action, owned by [Threat Detection](contexts/threat-detection.md); independent of
  Classification's pipeline by design (research §3.3's "recommended layering").

## Cross-cutting infrastructure concepts

- **Watch Subscription / Sync Cursor** — Mailbox Ingestion's platform-sync mechanics (Gmail
  `watch()`+`historyId`, Outlook `/subscriptions`+`deltaLink`); never referenced outside that
  context.
- **Facet** — a category of independently-published verdict about a message
  (`Category`-labels, `ThreatAssessment`, `ContactClassification`, `PriorityScore`) that
  Mailbox Write-back composes onto the platform message. "Facet" is the vocabulary Write-back
  uses to talk about the four upstream streams generically without importing their internal
  shapes.
- **Divergence** — a mismatch Mailbox Write-back detects between what it last applied and
  what a later sync shows on the platform; the raw signal Feedback & Learning turns into a
  passive correction.
- **Correction** — an observed or explicit signal that a prior verdict (from any of
  Classification, Prioritization, Threat Detection, or Contact Graph) was wrong, owned by
  [Feedback & Learning](contexts/feedback-learning.md). Always tagged with which context's
  verdict it corrects and how it was observed (`PassiveInferred | ExplicitUserAction |
  AdminOverride`).
- **Sender Reputation Cache** — the domain→historical-category cache (research §5.3) that
  lets Classification's Rule tier shortcut repeat senders; owned by Feedback & Learning,
  consumed by Classification.
- **Few-Shot Example Set** — the versioned, per-category LLM prompt examples; curated by
  Feedback & Learning, consumed by Classification (and, with its own instance, by Threat
  Detection's intent-classification layer).

## Commercial concepts

- **Plan / Entitlement** — the named commercial tier and its specific capped capabilities,
  owned by [Tenant & Subscription](contexts/tenant-subscription.md); every other context that
  enforces a quota or ceiling (mailbox count, LLM tier ceiling, digest frequency) reads
  `Entitlement` values as a conformist, never redefining its own quota logic.
- **Usage Meter** — a running per-tenant counter over one billable dimension, owned by Tenant
  & Subscription, fed by usage-fact events published from Mailbox Ingestion, Classification,
  Mailbox Write-back, and Notification & Alerting.
- **Scope Set** — the exact, minimal OAuth permission list held for a mailbox connection,
  owned by Identity & Access, implementing the scope-minimization stance from research §5.4.

## Event-naming convention

Past-tense, domain-meaningful names (`MessageIngested`, `MessageClassified`,
`MessageThreatAssessed`, `SenderClassified`, `MessagePrioritized`,
`WriteBackDivergenceDetected`) — never CRUD-shaped names (`MessageUpdated`,
`RecordCreated`). Every event that crosses a context boundary carries `tenantId` as its first
field and, where it concerns a specific message, `messageId` as its second — this pairing is
the de facto shared vocabulary every context's event handlers key off.
