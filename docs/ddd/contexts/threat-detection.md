# Threat Detection Context

## Purpose / responsibility

Threat Detection owns phishing and business-email-compromise (BEC) detection, independent
from the general Classification pipeline, because the research report treats it as
qualitatively different work: platform-native filtering already blocks the most obvious
attacks before the system ever sees them (research §3.3), so this context's job is the
*residual* — technically-authenticated-but-fraudulent mail (lookalike domains, §3.2) and
mail that passes every header check but reads as a compromise attempt (§3.3's LLM
intent-classification finding). It layers three checks per the recommended architecture
(§3.3 "recommended layering"): authentication-based scoring (SPF/DKIM/DMARC), lookalike/
typosquat domain scoring against a brand watchlist, and LLM-based intent classification for
the tail that clears authentication but still looks wrong. Its output decides whether a
message is quarantined outright or merely flagged, per the still-open design question in
research §6, decision #3 — this context makes that decision configurable per tenant rather
than hardcoding one answer.

## Ubiquitous language

- **Threat Assessment** — the result of running a message through all three detection
  layers for one message.
- **Authentication Signal** — SPF/DKIM/DMARC pass/fail/none plus alignment result.
- **Lookalike Score** — a string-distance/homoglyph similarity measure of the sender domain
  against (a) a brand watchlist and (b) domains the mailbox owner has actually corresponded
  with before (research §3.2 — DMARC alone cannot catch a domain the attacker legitimately
  registered and authenticates itself).
- **Intent Classification** — the LLM-derived phishing intent category, following the
  arXiv:2506.14337 approach cited in research §3.3: `CredentialHarvesting | BEC |
  MalwareDelivery | None`.
- **Quarantine Decision** — the enforcement action taken: `Flag | Quarantine | None`,
  configurable per tenant policy.
- **Brand Watchlist** — the shared/global list of high-value brand domains commonly
  impersonated, used for lookalike comparison (research §3.2, §5.3 calls this out as
  global/shared, not per-tenant, state).

## Aggregate roots

### `ThreatAssessment` (aggregate root)

Identity: `(TenantId, MessageId)`.

Invariants:
- All three layers (`AuthenticationSignal`, `LookalikeScore`, `IntentClassification`) are
  independently computable and independently nullable — a message can be flagged purely on
  a failed DMARC check without waiting for the (slower, costlier) LLM intent layer, and vice
  versa; the aggregate does not force full-pipeline completion before it can publish a
  preliminary high-confidence verdict, because the research explicitly notes phishing has a
  tight latency SLA (§6, decision #4).
- Once `Quarantine` is decided, the assessment is `Locked` — it cannot be silently
  downgraded by a later, lower-confidence re-run; only an explicit user or admin override
  (captured as its own event, feeding Feedback & Learning) can reverse a quarantine.
- The `IntentClassification` layer is only invoked when authentication and lookalike layers
  don't already produce a high-confidence verdict, mirroring the tiered cost-control pattern
  from Classification (research §2.3) — Threat Detection reuses the same escalation
  philosophy but keeps its own tier state, because its escalation triggers (DMARC fail,
  lookalike score, brand impersonation) are domain-specific to threat detection, not the
  general classification taxonomy.

## Entities and value objects

- `AuthenticationSignal` (value object): `spf`, `dkim`, `dmarc` (each `pass | fail | none`),
  `alignmentResult`.
- `LookalikeScore` (value object): `candidateDomain`, `matchedBrand` (nullable),
  `editDistance`, `homoglyphMatch: bool`, `priorCorrespondenceWithDomain: bool`.
- `IntentClassification` (value object): `intent`, `confidence`, `justification` (short,
  structured — never free text stored verbatim from the model without schema constraint).
- `QuarantineDecision` (value object): `action`, `decidedBy` (`policy | admin | user`),
  `decidedAt`, `reversible: bool`.
- `ThreatDetectionTier` (value object): `AuthCheck | LookalikeCheck | IntentLlm`, mirrors
  Classification's tier concept but scoped to this context.

## Domain events published

- **`MessageThreatAssessed`** — `{ tenantId, messageId, authenticationSignal,
  lookalikeScore, intentClassification, quarantineDecision, assessedAt }`. Triggered when an
  assessment reaches a terminal state (either a high-confidence early layer verdict, or full
  three-layer completion). Primary published-language event; consumed by Mailbox Write-back
  and Notification & Alerting.
- **`MessageQuarantined`** — `{ tenantId, messageId, reason, decidedAt }`. Narrower, urgent
  event fired specifically on a `Quarantine` decision, so Notification & Alerting and
  Write-back can react immediately rather than waiting on the full assessment payload.
- **`QuarantineOverridden`** — `{ tenantId, messageId, overriddenBy, previousDecision,
  newDecision, reason }`. Triggered on explicit user/admin reversal; consumed by Feedback &
  Learning as a strong correction signal (false positive).

## Repository interfaces (ports)

- `ThreatAssessmentRepository` — load/save by `(TenantId, MessageId)`.
- `BrandWatchlistRepository` — the shared/global brand-domain list (research §5.3); read by
  the lookalike-scoring service, maintained by a security/ops process outside this context's
  everyday write path.
- `CorrespondenceHistoryReadModel` (port) — a read-only projection of domains the mailbox
  owner has previously sent mail *to*, used as one lookalike-scoring input; sourced from
  Contact Graph rather than recomputed here.

## Anti-corruption layer notes

- `ThreatIntentClassifierAdapter` reuses the same `ClassifierPort` abstraction defined in
  Classification for its LLM calls (structured output, tiered model selection), but is
  configured with threat-specific system prompting and a narrower output schema (intent
  category, not the 11-category taxonomy) — it is a distinct adapter instance, not a shared
  mutable client, since threat-intent prompting warrants independent versioning and A/B
  evaluation from general classification prompts.
- An optional `ThreatIntelAdapter` wraps external reputation services (Google Safe Browsing,
  VirusTotal) for supplementary URL/attachment-hash checks, per research §3.3's note that no
  single unified integration point exists across these — this ACL absorbs each provider's
  distinct request/response shape and rate limits behind one `checkUrlReputation` /
  `checkAttachmentHash` port; it is explicitly optional/pluggable since Defender for
  Office 365 already covers much of this for Outlook-sourced mail.
- Deliberately does **not** wrap Microsoft Defender for Office 365 or Gmail's own spam
  filtering — those already ran before Mailbox Ingestion ever saw the message; this context
  only ever sees mail that already survived platform-native filtering.

## Relationships to other contexts

- **Downstream of Mailbox Ingestion** — consumes `MessageIngested` for header/domain data
  (SPF/DKIM/DMARC results, sender domain) needed for the authentication and lookalike layers.
- **Downstream of Contact Graph** — consumes correspondence-history facts for lookalike
  scoring (has the mailbox owner emailed this exact domain before).
- **Upstream of Mailbox Write-back / Sync** — `MessageThreatAssessed` is one of the four
  facet streams Write-back applies (quarantine action, `PhishingAttempt` label).
- **Upstream of Notification & Alerting** — `MessageQuarantined` drives the highest-urgency
  alert class in the system.
- **Upstream of Feedback & Learning** — `QuarantineOverridden` is a high-value correction
  signal distinct from routine category corrections.
- **Not directly coupled to Classification** — phishing is not one of Classification's
  self-computed categories; the two contexts run independently and only converge at
  Mailbox Write-back.
