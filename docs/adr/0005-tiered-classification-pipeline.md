# 0005. Tiered classification pipeline architecture

## Status
Accepted

## Date
2026-08-07

## Context
The research converges strongly on a "cheap-first, LLM-as-fallback" pipeline (research §2.3, §6): rules resolve the easy majority at near-zero cost, a cheap/fast LLM tier handles the bulk of the remainder, and an expensive frontier-model tier is reserved for the genuinely ambiguous tail. The cited rule of thumb: if a cheap model resolves 70% of volume correctly and the expensive model costs 12x more, routing only the residual 30% to the expensive tier costs ~4.6x the cheap-only price — well under half of routing everything through the expensive model (research §2.3). The research's own synthesized architecture diagram (research §6) lays out exactly three tiers plus a downstream prioritization scorer and write-back stage.

## Decision
We adopt the three-tier pipeline from research §6 as the authoritative classification architecture, implemented as a sequence of BullMQ job stages (see [[0002-technology-stack-selection]]) operating on the `NormalizedMessage` envelope (see [[0003-platform-normalization-layer]]):

- **Tier 1 — Deterministic rules** (milliseconds, $0): sender/domain and brand-watchlist matching, `List-Unsubscribe`/`Precedence`/`Auto-Submitted`/`List-Id` header checks, SPF/DKIM/DMARC pass-fail, `text/calendar; METHOD:CANCEL` detection, schema.org/JSON-LD e-commerce markup, and thread/conversation-state analysis (research §2.1, §6). Rules resolve newsletters, e-commerce, LinkedIn, generic social, meeting cancellations, and sales/deals for the majority of volume with near-100% precision. High-confidence Tier 1 output terminates the pipeline for that message (subject to the confirmation-sampling policy in [[0014-feedback-loop-continuous-learning]]).
- **Tier 2 — Cheap LLM classifier** (Haiku-class model, research §2.3, §7): structured JSON output, few-shot prompted (~5 examples per label category per research §2.3), multi-label over the 11 categories plus confidence. Receives messages Tier 1 could not resolve with high confidence.
- **Tier 3 — Frontier LLM** (Sonnet/Opus-class, research §2.3, §7): reasoning-heavy cases — phishing intent classification, BEC/urgency framing, nuanced prioritization scoring — reserved for the still-ambiguous or high-stakes tail per research §6.
- **Prioritization scorer**: a deterministic composite scorer consumes the classification output plus VIP/interaction/calendar signals (see [[0009-prioritization-urgency-scoring-model]]), independent of which tier resolved the category.
- **Write-back adapter**: applies the final multi-label result via the platform adapters from [[0003-platform-normalization-layer]].

Routing between tiers is governed by a confidence threshold configurable per category (not a single global cutoff), because research §2.1 and §2.4 indicate precision varies sharply by category — e.g., `METHOD:CANCEL` detection is near-deterministic while "needs a reply" is explicitly one of the harder categories to resolve with rules alone (research §2.4) and should default to a lower Tier-1 confidence threshold, routing more of that category's volume to Tier 2/3.

## Consequences

### Positive
- Directly implements the research's synthesized, evidence-grounded architecture rather than inventing a new pipeline shape.
- Cost stays bounded and predictable as inbox volume grows, because the expensive tiers only see the fraction of mail rules and cheap models cannot resolve (research §2.3 cost-ratio argument) — load-bearing for commercial viability (see [[0007-llm-provider-model-tiering-cost-governance]], [[0021-usage-metering-billing]]).
- Per-category confidence thresholds let us tune precision/recall/cost independently per category as real classification data accumulates (see [[0022-testing-and-evaluation-strategy]]), rather than a one-size-fits-all cutoff.

### Negative
- Three tiers plus a scorer is more implementation and operational surface than a single-model classifier — more code paths to test, more places for a bug to hide.
- Per-category confidence thresholds require ongoing tuning and add configuration surface that must itself be tested and versioned (see [[0018-deployment-cicd-safe-rollout]]).

### Risks
- Threshold mis-tuning in either direction is costly: too aggressive (trusting Tier 1 too readily) risks silent misclassification at scale; too conservative (routing too much to Tier 2/3) erodes the cost advantage the whole design exists to capture. Mitigated by the eval harness in [[0022-testing-and-evaluation-strategy]] and shadow evaluation in [[0018-deployment-cicd-safe-rollout]] before any threshold or prompt change ships.

## Alternatives Considered
- **Single LLM call classifies everything** — rejected: research §2.3 shows this costs meaningfully more than the tiered approach with no accuracy benefit for the majority of volume that rules already resolve deterministically and auditably.
- **Two tiers only (rules + one LLM)** — rejected: collapses the cost/quality trade-off research §2.3 identifies between "cheap enough to run on every message" and "capable enough for phishing-intent and nuanced prioritization reasoning" into one model, forcing a worse compromise on either cost or the hardest cases (BEC, spear-phishing) where the research specifically calls for frontier-model reasoning (research §3.3).
- **Traditional ML classifier (SVM/TF-IDF or embeddings + lightweight classifier) as a tier** — considered per research §2.2, but rejected for v1: requires a labeled training pipeline and MLOps investment the research itself flags as more than most teams want to carry, and the LLM-based approach adapts to new/refined categories via prompt changes rather than retraining (research §2.2, §2.3). May be revisited as a cost-optimization once sufficient labeled correction data exists (see [[0014-feedback-loop-continuous-learning]]).

## Related ADRs
[[0003-platform-normalization-layer]], [[0006-multi-label-classification-data-model]], [[0007-llm-provider-model-tiering-cost-governance]], [[0008-rule-engine-ownership]], [[0009-prioritization-urgency-scoring-model]], [[0022-testing-and-evaluation-strategy]]
