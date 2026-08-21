# 0026. Golden-dataset & shadow-evaluation harness

## Status
Accepted

## Date
2026-08-21

## Context
[0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md) requires every classification-affecting change to pass shadow evaluation against a golden dataset before canary promotion, and [0022-testing-and-evaluation-strategy](0022-testing-and-evaluation-strategy.md) requires per-category precision/recall/F1 tracking, not aggregate accuracy. The Stage 4 implementation prompt in `docs/implementation-plan.md` specifies this harness be built once, at Classification, and reused by every later classification-affecting stage: Threat Detection's phishing false-negative-rate tracking ([0010-phishing-detection-layering-and-incident-response](0010-phishing-detection-layering-and-incident-response.md)), Prioritization's scoring-weight changes ([0009-prioritization-urgency-scoring-model](0009-prioritization-urgency-scoring-model.md)), and Feedback & Learning's few-shot-set updates ([0014-feedback-loop-continuous-learning](0014-feedback-loop-continuous-learning.md)).

An audit of the running codebase found this harness does not exist at all — a repo-wide search for golden-dataset, shadow-eval, or eval-harness code returns no matches (issue #39). What does exist, `CanaryRolloutService`, is a genuinely solid, well-persisted implementation of hash-based tenant bucketing and version-pointer rollback — but it has no upstream gate deciding whether a candidate `pipeline_version` is actually safe to promote in the first place. A change can currently reach canary with zero accuracy signal behind it.

## Decision
- **Build a `classification-eval` module** owning:
  1. A versioned golden-dataset store: hand-labeled messages stratified for the boundary-ambiguous cases the research explicitly flagged (LinkedIn-digest-with-a-job-posting vs. Jobs, Sales & Deals vs. Newsletter), plus a phishing-labeled subset dedicated to Threat Detection's false-negative-rate requirement.
  2. An evaluation runner that replays the dataset through a candidate `pipeline_version` and computes per-category precision/recall/F1, and — as a distinct, separately tracked, non-negotiable metric — the phishing false-negative rate on high-confidence quarantine actions.
  3. A shadow-eval gate service that `CanaryRolloutService.promote()` calls before promoting any candidate version: promotion is blocked unless the candidate's per-category scores meet configured acceptance thresholds (no regression beyond a configured tolerance) **and** the phishing false-negative rate does not increase at all, regardless of any other metric's improvement.
- **One shared harness, reused, not rebuilt per stage.** Any change to a Tier-1 rule, an LLM prompt or few-shot set, a Prioritization scoring weight, or a Feedback & Learning few-shot example set must run through this harness and receive a passing shadow-eval verdict before its version is eligible for canary promotion.
- **Dataset governance**: additions or edits to the golden dataset go through the same PR review as code, per [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md)'s change-ownership decision. Any real-traffic sample added to the shadow-eval comparison set is de-identified first, per [0013-data-retention-encryption-privacy](0013-data-retention-encryption-privacy.md).
- **Dashboard, not just logs.** Per-category precision/recall/F1 and the phishing false-negative rate are exposed on the observability dashboard established by [0016-observability-slas-alerting](0016-observability-slas-alerting.md), matching Stage 4's original Done criteria (a dashboard, not an aggregate accuracy number buried in logs).
- **Dependency on adapter realism.** This harness only produces meaningful numbers once the classifier adapter it evaluates actually classifies — see [0025-external-adapter-realism-policy](0025-external-adapter-realism-policy.md), which separately addresses `AnthropicClassifierAdapter` currently discarding its real API response.

## Consequences

### Positive
- Closes a hard Done= requirement from Stage 4 that was blocking sign-off on Stages 4, 6, 7, and 9 simultaneously, since each depends on this shared harness.
- Gives the already-solid `CanaryRolloutService` an actual upstream gate, so promotion decisions are backed by measured accuracy rather than only by rollout percentage/bucketing mechanics.
- Makes the phishing false-negative-rate commitment implied by [0010-phishing-detection-layering-and-incident-response](0010-phishing-detection-layering-and-incident-response.md) enforceable in CI rather than aspirational.

### Negative
- Real engineering lift: dataset curation, an evaluation runner, and threshold tuning are nontrivial and ongoing work, not a one-time build.
- Each shadow-eval run consumes LLM budget per [0007-llm-provider-model-tiering-cost-governance](0007-llm-provider-model-tiering-cost-governance.md) for a change that may not even ship — this is an accepted cost of catching regressions before they reach real tenant mail, consistent with [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md)'s existing trade-off reasoning.

### Risks
- The harness is only as good as the golden dataset's coverage; a change can pass shadow-eval and still regress a real-world pattern underrepresented in the dataset. This is explicitly acknowledged and mitigated — not eliminated — by the canary stage as a second, real-traffic check, per [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md).
- A zero-tolerance gate on phishing false-negative rate could, in principle, block a change that improves every other metric. This is a deliberate trade-off given the safety-criticality established in [0010-phishing-detection-layering-and-incident-response](0010-phishing-detection-layering-and-incident-response.md), not an oversight.

## Alternatives Considered
- **Ship classification-affecting changes with only unit-test coverage, no golden dataset** — rejected: this is the current state, directly violates the Stage 4/[0022-testing-and-evaluation-strategy](0022-testing-and-evaluation-strategy.md) Done criteria, and provides no aggregate-accuracy signal before a change affects real tenant mail.
- **Per-stage bespoke eval harnesses** (Threat Detection builds its own false-negative tracker, Prioritization builds its own weight-change evaluator, independently) — rejected: the implementation plan explicitly specifies one shared harness reused across stages; duplicating it fragments acceptance criteria across contexts and multiplies maintenance cost for what is fundamentally the same "replay against labeled data, compare to threshold" mechanism.

## Related ADRs
[0005-tiered-classification-pipeline](0005-tiered-classification-pipeline.md), [0006-multi-label-classification-data-model](0006-multi-label-classification-data-model.md), [0007-llm-provider-model-tiering-cost-governance](0007-llm-provider-model-tiering-cost-governance.md), [0009-prioritization-urgency-scoring-model](0009-prioritization-urgency-scoring-model.md), [0010-phishing-detection-layering-and-incident-response](0010-phishing-detection-layering-and-incident-response.md), [0013-data-retention-encryption-privacy](0013-data-retention-encryption-privacy.md), [0014-feedback-loop-continuous-learning](0014-feedback-loop-continuous-learning.md), [0016-observability-slas-alerting](0016-observability-slas-alerting.md), [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md), [0022-testing-and-evaluation-strategy](0022-testing-and-evaluation-strategy.md), [0025-external-adapter-realism-policy](0025-external-adapter-realism-policy.md)
