# Feedback & Learning Context

## Purpose / responsibility

Feedback & Learning closes the loop the research report identifies as necessary but
mechanically undecided (§6, open decision #7): capturing user corrections and turning them
into concrete improvements — refreshed few-shot examples, updated sender-reputation entries,
and triggers for prompt/model version bumps — without the system ever retraining a model from
scratch (per §2.2/§2.3, the whole architecture deliberately avoids owning an MLOps training
pipeline in favor of prompt-adaptable LLM tiers). It supports both correction-capture modes
the research surfaces: passive inference (the user moved/relabeled a message — noisier but
frictionless) and explicit correction (a dedicated "this was miscategorized" action — higher
signal, more friction) as two distinct, separately-trusted evidence types rather than forcing
a single mechanism.

## Ubiquitous language

- **Correction** — a single observed or explicit signal that a prior classification,
  priority, threat, or contact verdict was wrong, in whole or in part.
- **Correction Source** — `PassiveInferred | ExplicitUserAction | AdminOverride`, carrying
  different trust weights.
- **Sender Reputation Cache** — the domain→historical-category cache (research §5.3) that
  lets the Rule tier resolve "another newsletter from this already-known sender" without a
  fresh LLM call every time.
- **Few-Shot Example Set** — the versioned, per-category example pool Classification's LLM
  tiers consume; curated here from high-trust corrections.
- **Prompt/Taxonomy Version** — a version marker bumped when accumulated corrections justify
  a materially different prompt or rule-weight configuration, triggering a backfill
  reclassification wave.

## Aggregate roots

### `CorrectionRecord` (aggregate root)

Identity: internally minted `CorrectionId`, referencing `(TenantId, MessageId)`.

Invariants:
- Every `CorrectionRecord` captures both the system's original verdict and the corrected
  verdict, and which upstream context/aggregate the original verdict came from
  (`Classification | Prioritization | ThreatDetection | ContactGraph`) — corrections are
  routed back only to their originating context's published language, never applied
  cross-context by guesswork.
- A `PassiveInferred` correction (e.g., user moved a message to a different Gmail label) is
  quarantined in a `Candidate` state and is **not** used to update reputation caches or
  few-shot pools until either (a) it's corroborated by a repeated pattern from the same user
  for similar messages, or (b) explicitly confirmed — this directly addresses the research's
  caution (§6, decision #7) that a single passive move could be for reasons unrelated to
  category correctness and would otherwise pollute the training signal.
- `ExplicitUserAction` and `AdminOverride` corrections are trusted immediately (no
  corroboration wait) and can directly update `SenderReputationCache` and seed new few-shot
  examples.
- A `CorrectionRecord` that would invert a `Locked` `ThreatAssessment` quarantine decision
  (from Threat Detection) requires `AdminOverride` specifically — an ordinary user correction
  is insufficient to reverse a quarantine on its own, reflecting the asymmetric cost of a
  false negative there.

### `SenderReputationCache` (aggregate root)

Identity: `(TenantId, SenderDomain)`.

Invariants:
- Holds a rolling, confidence-weighted history of categories previously assigned to messages
  from this domain; only updated by trusted (non-`Candidate`) corrections and by
  high-confidence `MessageClassified` outcomes over time, never overwritten by a single
  low-confidence signal.
- Consulted, not authoritative — Classification's Rule tier treats a reputation-cache hit as
  a strong prior that raises confidence and can shortcut escalation, but a `CorrectionRecord`
  contradicting the cache always wins over the cached prior for that specific message.

## Entities and value objects

- `VerdictSnapshot` (value object): `originatingContext`, `originalVerdict`,
  `correctedVerdict`, capturing enough shape to be diffed and applied back as a `FewShot`
  example candidate.
- `CorrectionEvidence` (value object): `source`, `observedAt`, `corroborationCount` (for
  `Candidate` records awaiting pattern confirmation).
- `FewShotExampleCandidate` (entity, child of a curation batch): `category`, `messageExcerpt`
  (redacted/minimized per privacy constraints — see ACL note), `label`, `promotedFrom`
  (`CorrectionId`).
- `ReputationEntry` (value object, child of `SenderReputationCache`): `category`,
  `observationCount`, `confidenceWeight`, `lastUpdatedAt`.

## Domain events published

- **`UserCorrectionObserved`** — `{ tenantId, messageId, source, verdictSnapshot,
  observedAt }`. Internal-facing event marking a new `CorrectionRecord` created (from
  Write-back's next-sync observation or an explicit in-app action).
- **`FewShotExampleSetUpdated`** — `{ tenantId (nullable — may be a global default set),
  category, exampleSetVersion, updatedAt }`. Triggered when a curation batch promotes new
  examples. Primary published-language event to Classification.
- **`SenderReputationUpdated`** — `{ tenantId, senderDomain, category, confidenceWeight,
  updatedAt }`. Consumed by Classification's Rule tier.
- **`ContactSignalReinforced`** — `{ tenantId, mailboxId, senderAddress, reinforcement
  (`towardPersonal | towardAutomated | vipRevoked`), reason }`. Consumed by Contact Graph.
- **`TaxonomyVersionBumpTriggered`** — `{ tenantId (nullable), reason, proposedVersion }`.
  Triggered when accumulated correction volume/pattern crosses a configurable threshold;
  consumed by Classification to schedule a `MessageReclassified` backfill wave.

## Repository interfaces (ports)

- `CorrectionRecordRepository` — load/save/query by `(TenantId, MessageId)` and by
  `CorrectionSource` (for corroboration-window queries over `Candidate` records).
- `SenderReputationCacheRepository` — load/save by `(TenantId, SenderDomain)`.
- `FewShotCurationRepository` — manages curation batches and promoted `FewShotExampleSet`
  versions, shared with Classification's `FewShotExampleRepository` only via the published
  event, never a shared table.

## Anti-corruption layer notes

Feedback & Learning has no external-platform ACL of its own — it is entirely downstream of
other bounded contexts' published languages. Its one boundary discipline is internal-privacy,
not platform-integration: when promoting a `CorrectionRecord` into a `FewShotExampleCandidate`
containing message excerpt text, it applies redaction/minimization (strip PII patterns,
truncate to the smallest span that demonstrates the label) before that excerpt can be
persisted into a prompt-bound few-shot set — consistent with the research's data-minimization
guidance (§5.4) even though the raw trigger is a correction event, not a fresh platform read.

## Relationships to other contexts

- **Downstream of Mailbox Write-back / Sync** — the primary source of passive corrections:
  a user manually re-labeling in Gmail or re-filing in Outlook surfaces on the *next*
  ingestion delta as an observed divergence from what Write-back last applied.
- **Upstream of Classification** (Open Host Service / Published Language, and Classification
  is conformist to `Category`) — publishes `FewShotExampleSetUpdated`,
  `SenderReputationUpdated`, and `TaxonomyVersionBumpTriggered`.
- **Upstream of Contact Graph** — publishes `ContactSignalReinforced`.
- **Downstream of Threat Detection** — consumes `QuarantineOverridden` as a distinct,
  high-trust `AdminOverride` correction type.
