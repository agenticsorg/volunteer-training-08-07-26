# 0010. Phishing detection layering & incident response policy

## Status
Accepted

## Date
2026-08-07

## Context
The research lays out a specific, evidence-graded layering for phishing detection (research §3, §6):

1. **Native platform filtering runs first** — both Gmail and Outlook (especially with Defender for Office 365) block/flag the most obvious phishing before our pipeline even sees the message (research §3.3).
2. **Authentication + lookalike-domain checks** — SPF/DKIM/DMARC failure combined with brand impersonation is "one of the highest-value, cheapest-to-compute phishing signals" (research §3.1), but DMARC alone does not catch lookalike domains that self-authenticate (research §3.2) — Zscaler ThreatLabz found 30,000+ lookalike domains targeting the top 500 sites, 10,000+ confirmed malicious, so this requires a dedicated string-distance/homoglyph check against a brand watchlist and the user's own correspondent history.
3. **LLM intent classification** for the residual tail — arXiv:2506.14337 demonstrates LLMs classifying phishing by *intent* (credential harvesting, BEC, malware delivery) from visible text alone, addressing cases where traditional metadata-based detectors miss BEC-style attacks from genuinely-authenticated-but-compromised or freshly-registered domains (research §3.3).

The research also flags an explicit open decision (research §6, open decision #3): should a flagged-phishing email be **excluded from all other categorization (quarantined)**, or still receive its other labels for visibility (a soft flag alongside normal routing)?

## Decision
**Detection layering** follows the research's recommended sequence exactly (research §3.3, "Recommended layering"): (1) trust native platform filtering as the first line — we do not attempt to re-implement or second-guess what Gmail/Defender already blocked pre-delivery; (2) Tier 1 rule checks for SPF/DKIM/DMARC failure combined with display-name/brand impersonation, plus a dedicated lookalike-domain check (string-distance/homoglyph comparison against a maintained brand watchlist and the tenant's own prior-correspondent domains — research §3.2, since DMARC alone cannot catch this); (3) Tier 3 LLM intent classification (Sonnet/Opus-class per [[0007-llm-provider-model-tiering-cost-governance]]) for messages that pass technical authentication but carry urgency/authority/financial-request framing characteristic of BEC.

**Incident response action — resolving open decision #3**: we adopt a **severity-tiered action policy**, not a single flag-or-quarantine choice:
- **High-confidence phishing** (failed DMARC + brand impersonation + malicious-pattern match, or Tier 3 LLM high-confidence intent classification): **quarantine** — the message is excluded from normal categorization/routing, moved to a dedicated "Quarantined" state (a distinct Gmail label / Outlook folder, not comingled with the 11-category taxonomy), and the tenant is notified. This is the higher-risk action (a false positive hides a legitimate email) and is therefore reserved for high-confidence signals only.
- **Medium-confidence / ambiguous signals** (e.g., one authentication check fails but no brand impersonation, or Tier 3 flags "unusual but not clearly malicious"): **soft flag** — the message keeps its normal categorization and routing (still gets its other labels per [[0006-multi-label-classification-data-model]]) but carries a visible `phishing_flag: flagged` marker surfaced in the API/UI, erring toward visibility over hiding mail the user may legitimately need.
- All quarantine actions are **reversible** (tenant can release a quarantined message) and logged as a security-relevant event distinct from ordinary classification corrections (see [[0014-feedback-loop-continuous-learning]]), since a phishing false-positive/negative has different stakes than a "this newsletter should have been Sales & Deals" correction.

## Consequences

### Positive
- Layering avoids duplicating work the platforms already do well (research §3.3) while adding the two things they don't: cross-platform lookalike-domain detection and LLM-based intent classification for text-only BEC signals.
- Severity-tiered quarantine-vs-flag directly resolves the research's open decision with a defensible policy: the more disruptive action (quarantine, which risks hiding legitimate mail) is gated behind higher confidence than the less disruptive one (flag).
- Reversibility and audit logging on quarantine actions limit the damage of a false positive and create the data needed to tune confidence thresholds over time.

### Negative
- Running our own lookalike-domain and LLM-intent layers on top of native filtering adds latency and Tier 3 LLM cost to every message that reaches that stage — bounded by the budget governance in [[0007-llm-provider-model-tiering-cost-governance]].
- Maintaining a brand watchlist for lookalike-domain comparison is an ongoing curation cost (new brands, expiring watchlist entries) — owned as a shared/global dataset per [[0003-platform-normalization-layer]]'s data model (research §5.3: "global/shared... brand-domain watchlist for lookalike detection").

### Risks
- **False negatives** (a sophisticated, well-authenticated BEC attack slips through as "medium confidence" and is only soft-flagged) remain the primary residual risk the research identifies as the hardest case (research §3.3) — mitigated but not eliminated by Tier 3 LLM intent classification; this is disclosed as a known limitation, not a solved problem.
- **False positives on quarantine** (a legitimate but unusual email — e.g., a first-time sender with a slightly unusual domain — gets quarantined) directly harm trust; mitigated by the high-confidence-only gate on quarantine and full reversibility.

## Alternatives Considered
- **Always quarantine on any phishing signal** — rejected: the research notes native filters already catch the obvious cases pre-delivery, so anything reaching our pipeline is by definition more ambiguous; auto-quarantining on medium-confidence signals would produce an unacceptable false-positive rate and erode trust.
- **Never quarantine, flag-only** — rejected: for high-confidence cases (failed auth + brand impersonation + malicious pattern), leaving a near-certain phishing email in normal routing is a worse user-safety outcome than a reversible quarantine action.
- **Build a custom sandboxing/attachment-detonation layer** — rejected as out of scope: research §3.3 notes Defender for Office 365 already provides this for Outlook pre-delivery, and Gmail's own filtering serves a similar role; replicating detonation infrastructure ourselves is high-cost, high-liability, and duplicates what native platforms already do well.

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0007-llm-provider-model-tiering-cost-governance]], [[0014-feedback-loop-continuous-learning]], [[0016-observability-slas-alerting]]
