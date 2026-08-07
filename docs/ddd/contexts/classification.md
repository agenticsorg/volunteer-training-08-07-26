# Classification Context

## Purpose / responsibility

Classification owns the 11-category taxonomy and the tiered rules→LLM pipeline (research
§2.3, §6) that assigns it. For every `MessageIngested` event it runs deterministic-rule
evaluation first (near-zero cost, majority of volume resolved), escalates the ambiguous
residual to a cheap LLM tier, and escalates the still-ambiguous residual further to a
frontier-reasoning LLM tier — publishing a multi-label `MessageClassified` result with
per-label confidence rather than a single winning category, because the taxonomy is
explicitly multi-label (research §6, open decision #2: a message can be e-commerce *and*
needs-a-reply *and* high-priority at once). Classification directly computes seven of the
eleven content-shaped categories (newsletters, job postings, social, e-commerce, sales &
deals, LinkedIn, meeting cancellations) plus the needs-a-reply signal; phishing, personal
contact, and priority tier are computed by their own specialist contexts and are *not*
duplicated here (see Relationships).

## Ubiquitous language

- **Category** — one label from the fixed 11-value taxonomy: `Newsletter`, `JobPosting`,
  `Social`, `Ecommerce`, `SalesAndDeals`, `LinkedIn`, `MeetingCancellation`, `NeedsReply`,
  `PhishingAttempt`, `PersonalContact`, `PriorityTier`. Classification directly assigns the
  first eight; the last three arrive as facets from Threat Detection, Contact Graph, and
  Prioritization respectively and are referenced, not computed, here.
- **Classification Tier** — `Rule | CheapLlm | FrontierLlm`, the escalation ladder a message
  climbs until confidence is sufficient.
- **Label Assignment** — one `(Category, confidence, sourceTier, evidence)` tuple.
- **Rule Signal** — a deterministic, auditable fact used by Tier 1: header presence
  (`List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`), sender-domain/brand-watchlist
  match, SPF/DKIM/DMARC pass-fail, `text/calendar; METHOD=CANCEL` detection, schema.org
  JSON-LD (`Order`, `ParcelDelivery`) presence, thread-state (last sender ≠ mailbox owner).
- **Few-Shot Example Set** — the curated, per-category example pool (research §2.3: ~5
  single-label examples per category outperform ambiguous multi-label examples) fed to the
  LLM tiers; versioned, refreshed by Feedback & Learning.
- **Confidence Score** — a 0.0–1.0 value per label; Rule-tier assignments are typically 0.95+
  by construction (deterministic signals), LLM-tier assignments carry a model-reported score.

## Aggregate roots

### `MessageClassification` (aggregate root)

Identity: `(TenantId, MessageId)`.

Invariants:
- Tiers are attempted strictly in order — a message may not be evaluated by `CheapLlm` before
  `Rule`, nor by `FrontierLlm` before `CheapLlm` — because each tier exists specifically to
  shrink the volume/cost the next tier must handle (research §2.3's "cheap-first" economics).
- The result set is **multi-label**: zero, one, or several of the eight self-owned categories
  may be assigned to the same message, each with its own confidence and source tier; there is
  no "the" category field.
- Once a `MessageClassification` reaches a terminal tier (rules resolved it with high
  confidence, or the frontier tier returned), it is `Finalized` and immutable — a later
  change only happens via an explicit `Reclassified` transition triggered by Feedback &
  Learning (e.g., a taxonomy/prompt version bump), never by silently overwriting history.
- `NeedsReply` may only be assigned after automated-sender exclusion rules have run (research
  §2.4): a message already carrying strong bulk/automated rule signals cannot also carry
  `NeedsReply`, regardless of LLM output — this is enforced as an invariant, not left to LLM
  discretion, to prevent the known failure mode of flagging newsletters as awaiting reply.

## Entities and value objects

- `LabelAssignment` (value object): `category`, `confidence`, `sourceTier`, `evidence` (free
  text/struct capturing the rule that fired or the LLM's structured justification).
- `ClassificationRun` (entity, child of `MessageClassification`): records each tier attempt —
  `tier`, `startedAt`, `completedAt`, `escalated: bool`, `modelId` (for LLM tiers),
  `costUnits` (tokens or rule-evaluation count, feeds Tenant & Subscription usage metering).
- `RuleSignalSet` (value object): the structured bag of Tier-1 facts evaluated for one
  message — `hasListUnsubscribe`, `hasPrecedenceBulk`, `hasAutoSubmitted`, `dmarcResult`,
  `senderDomainMatch`, `hasCalendarCancelMethod`, `hasEcommerceMarkup`,
  `threadAwaitingReply`.
- `TaxonomyVersion` (value object): identifies which category definitions and few-shot set
  version produced a given result, so results remain explainable after the taxonomy evolves.

## Domain events published

- **`MessageClassified`** — `{ tenantId, messageId, labels: LabelAssignment[], finalTier,
  taxonomyVersion, classifiedAt }`. Triggered when a `MessageClassification` reaches
  `Finalized`. Primary published-language event; consumed by Prioritization, Mailbox
  Write-back, and Notification & Alerting.
- **`ClassificationEscalatedToLlm`** — `{ tenantId, messageId, fromTier, toTier, reason }`.
  Triggered on each tier escalation; consumed internally for cost observability and by
  Tenant & Subscription for LLM-usage metering.
- **`ClassificationLowConfidence`** — `{ tenantId, messageId, labels, maxConfidence }`.
  Triggered when even the frontier tier can't clear a confidence floor; surfaces as a
  candidate for human/feedback review rather than being silently accepted.
- **`MessageReclassified`** — `{ tenantId, messageId, previousLabels, newLabels,
  triggeredBy }`. Triggered when Feedback & Learning's updated examples or a taxonomy version
  bump causes a backfill re-run.

## Repository interfaces (ports)

- `MessageClassificationRepository` — load/save by `(TenantId, MessageId)`.
- `TaxonomyRepository` — versioned category definitions (name, description, rule-tier
  signal weights, few-shot pointers); read-mostly, written by taxonomy admins/Feedback &
  Learning.
- `FewShotExampleRepository` — per-category example pool, versioned; read by the LLM ACL at
  prompt-build time.
- `RuleSignalEvaluator` (port, not a persistence repository) — pure evaluation service over a
  `MessageEnvelope`, kept as an injectable port so rule logic is independently testable from
  the aggregate.

## Anti-corruption layer notes

`LlmClassifierAdapter` isolates the Claude API from the domain model:
- Translates a `MessageEnvelope` + `RuleSignalSet` + `FewShotExampleSet` into a
  structured-output request constrained to a JSON schema (the 11-category enum +
  confidence + short justification — research §2.3), never free-text parsing.
- Chooses between interactive (standard pricing, low latency) and Batch API (50% discount,
  24h SLA) calls based on the message's urgency classification from the Rule tier — this
  routing decision lives in the ACL, not in the domain aggregate, because it's a
  cost/infrastructure concern, not a classification concern.
- Chooses model tier (Haiku-class for `CheapLlm`, Sonnet/Opus-class for `FrontierLlm`)
  behind the same `ClassifierPort.classify(tier, request)` signature, so the aggregate never
  references a model name directly — swapping providers or model generations doesn't touch
  domain code.
- Normalizes provider-side failures (rate limits, malformed structured output) into a
  domain-level `ClassificationTierFailed` outcome that triggers the tier-escalation rule
  rather than leaking an HTTP/SDK exception into the aggregate.

## Relationships to other contexts

- **Downstream of Mailbox Ingestion** — consumes `MessageIngested` as its trigger and sole
  source of `MessageEnvelope` data.
- **Downstream of Tenant & Subscription** (conformist) — reads `PlanEntitlements` to cap
  which tenants/plans may escalate to `FrontierLlm` at all, and at what daily ceiling.
- **Upstream of Prioritization** — `MessageClassified` supplies the `NeedsReply` signal and
  category context that feed the priority-scoring formula (research §2.5).
- **Upstream of Mailbox Write-back / Sync** — `MessageClassified` is one of four independent
  facet streams Write-back composes onto the platform message.
- **Upstream of Notification & Alerting** — aging, unanswered `NeedsReply` messages drive
  escalating alerts.
- **Upstream of Tenant & Subscription** — LLM tier usage (`ClassificationEscalatedToLlm`,
  `ClassificationRun.costUnits`) is a billable usage-metering signal.
- **Downstream of Feedback & Learning** (published-language consumer, conformist on
  `Category`) — consumes `FewShotExampleSetUpdated` and `SenderReputationUpdated` to improve
  future runs and to trigger `MessageReclassified` backfills; Classification does not define
  its own correction model, it defers entirely to Feedback & Learning's.
- **Not directly coupled to Threat Detection or Contact Graph** — `PhishingAttempt` and
  `PersonalContact` are independently computed and published by those contexts; Classification
  references the `Category` enum values for documentation purposes only and never computes
  them itself, avoiding duplicated phishing/contact logic.
