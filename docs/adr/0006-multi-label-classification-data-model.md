# 0006. Multi-label classification data model

## Status
Accepted

## Date
2026-08-07

## Context
The research flags this explicitly as an open decision (research §6, open decision #2): "the taxonomy as specified (11 categories including cross-cutting ones like 'Prioritization tier' and 'Needs a reply') strongly implies multi-label classification (a message can be e-commerce AND needs-a-reply AND high-priority simultaneously) — confirm this is the intended model before building a single-label pipeline." Concrete examples from the research support this: a LinkedIn digest that also contains a job posting is plausibly both LinkedIn and Jobs (research §6, open decision #1); an e-commerce shipping notice can simultaneously be low-priority and not need a reply, while a client email can be e-commerce-adjacent (an invoice dispute) *and* need a reply *and* be high-priority, all at once.

## Decision
We confirm and adopt **multi-label classification** as the data model, per the research's own analysis. A message's classification result is:

```
{
  message_id: string,
  labels: [{ category: enum(11 categories), confidence: float, source_tier: 1|2|3 }],  // 0..N entries
  priority_score: integer(0-100),          // independent, always exactly one value (see 0009)
  needs_reply: boolean,                     // may also appear as a label; kept as a first-class field
                                             // because it feeds prioritization directly (research §2.5)
  phishing_flag: enum(none|flagged|quarantined),  // see 0010 — orthogonal to the 11-category labels
  classified_at: timestamp,
  pipeline_version: string                  // for reproducibility, see 0018 / 0022
}
```

A message can carry zero, one, or several of the 11 category labels simultaneously, each with its own confidence and the tier that produced it. `priority_score` and `needs_reply` are modeled as cross-cutting scalar/boolean fields rather than mutually-exclusive categories, consistent with research §2.5's framing of prioritization as a composite score layered on top of, not competing with, the category labels. `phishing_flag` is modeled separately per the quarantine-vs-label decision in [[0010-phishing-detection-layering-and-incident-response]].

Storage: labels are persisted as rows in a `message_labels` table (one row per label per message) rather than a single denormalized array column, enabling per-category precision/recall tracking (see [[0022-testing-and-evaluation-strategy]]) and per-category confidence-threshold tuning (see [[0005-tiered-classification-pipeline]]) without scanning/parsing a blob.

## Consequences

### Positive
- Matches real-world email semantics the research surfaces (a message is legitimately e-commerce AND needs-a-reply AND high-priority) rather than forcing a lossy single-label approximation.
- Per-label rows make per-category analytics, threshold tuning, and eval-harness precision/recall tracking (research §6 open decision #6, and [[0022-testing-and-evaluation-strategy]]) straightforward SQL rather than requiring array-unpacking logic everywhere.
- `pipeline_version` on every classification result gives us reproducibility for the shadow-evaluation and rollback workflows in [[0018-deployment-cicd-safe-rollout]].

### Negative
- Multi-label write-back is asymmetric across platforms: Gmail's label model maps naturally (apply N labels), but Outlook's single-folder-location model means only one "primary" placement decision can be made even though `categories` (a settable array — research §1.2) can still carry all labels. This asymmetry must be resolved explicitly in the write-back adapter (see [[0003-platform-normalization-layer]]), e.g., folder = highest-confidence/highest-priority label, categories array = full label set.
- Multi-label ground truth is more expensive to build and evaluate against than single-label (each labeled example needs a *set* of correct categories, not one), raising the bar for the golden dataset in [[0022-testing-and-evaluation-strategy]].

### Risks
- Ambiguous category boundaries (Sales & Deals vs. Newsletters vs. Promotions tab; Social vs. LinkedIn — research §6 open decision #1) mean multi-label ground truth itself can be contested between human labelers. Mitigated by explicit labeling guidelines developed alongside the golden dataset (see [[0022-testing-and-evaluation-strategy]]) rather than leaving boundary cases to individual LLM-call discretion.

## Alternatives Considered
- **Single-label classification (pick the one best-fit category)** — rejected per the research's own conclusion (research §6 open decision #2): would force an arbitrary choice on messages that are legitimately multi-category, degrading both classification accuracy and the value of the prioritization signal, which needs to compose with categories rather than replace them.
- **Denormalized JSONB array of labels on the message row instead of a `message_labels` table** — considered given Postgres JSONB support (see [[0002-technology-stack-selection]]), but rejected as the primary storage: per-category analytics and threshold tuning are core, frequent operations (not occasional), and a normalized table serves them far more efficiently than JSONB querying at scale.

## Related ADRs
[[0002-technology-stack-selection]], [[0003-platform-normalization-layer]], [[0005-tiered-classification-pipeline]], [[0009-prioritization-urgency-scoring-model]], [[0010-phishing-detection-layering-and-incident-response]], [[0022-testing-and-evaluation-strategy]]
