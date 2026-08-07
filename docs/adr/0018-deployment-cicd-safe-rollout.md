# 0018. Deployment topology, CI/CD & safe rollout strategy

## Status
Accepted

## Date
2026-08-07

## Context
Classification behavior in this system is driven by three things that all change independently over time: application code, Tier 1 rule definitions (see [[0008-rule-engine-ownership]]), and LLM prompts/few-shot examples/model versions (see [[0005-tiered-classification-pipeline]], [[0007-llm-provider-model-tiering-cost-governance]], [[0014-feedback-loop-continuous-learning]]). The research does not directly address deployment/CI-CD, but its own recommendations imply a hard requirement: any prompt, rule, or weight change (e.g., the prioritization-scoring weights in [[0009-prioritization-urgency-scoring-model]], which the research explicitly flags as needing empirical validation rather than blind trust in the seed formula) must be evaluated before it silently changes how a paying tenant's mail is sorted.

## Decision
- **Deployment topology**: containerized services (API, workers per queue from [[0017-scalability-queueing-autoscaling]]) deployed to a managed container orchestration platform, with the shared-schema multi-tenant deployment from [[0015-multi-tenancy-data-isolation]] as the default, and an isolated-instance deployment option available for enterprise tenants with contractual isolation requirements.
- **CI pipeline gates** (required to merge/deploy): type checking and unit/integration tests (see [[0022-testing-and-evaluation-strategy]]); an RLS-policy-coverage check that fails the build if a new tenant-scoped table lacks a row-level-security policy (see [[0015-multi-tenancy-data-isolation]]); a secrets/dependency scan.
- **Safe rollout for classification-affecting changes specifically** (rule changes, prompt/few-shot changes, model-tier routing changes, scoring-weight changes): every such change goes through **shadow evaluation** before promotion — the new version classifies the same golden-dataset messages (see [[0022-testing-and-evaluation-strategy]]) and a sample of recent real (de-identified per [[0013-data-retention-encryption-privacy]]) traffic *in parallel* with the currently-live version, without affecting write-back actions, and the resulting precision/recall/cost deltas are reviewed against defined acceptance thresholds before the change is promoted.
- **Canary rollout**: after passing shadow evaluation, classification-affecting changes are promoted to a small percentage of live tenant traffic (opt-in beta tenants first, then a random low-percentage slice) with the same SLIs from [[0016-observability-slas-alerting]] monitored specifically for the canary cohort, before full promotion.
- **Rollback**: every classification-affecting change is tied to a `pipeline_version` (see [[0006-multi-label-classification-data-model]]); rollback is a version pointer change, not a code revert, and prior versions remain available for a defined retention window to support fast rollback and post-incident analysis.
- **Change ownership**: rule and prompt changes require the same review rigor as code changes (PR review, shadow-eval sign-off) — they are treated as production classification logic, not configuration that can bypass review, consistent with [[0008-rule-engine-ownership]]'s decision to keep rules centrally authoritative and auditable.

## Consequences

### Positive
- Shadow evaluation catches regressions (a rule tweak that mis-fires on a previously-correct category, a prompt change that degrades needs-reply recall) before any tenant's real mail is affected, directly protecting the trust the product depends on.
- Canary rollout limits blast radius of any regression that shadow evaluation didn't catch (e.g., a real-traffic distribution difference not represented in the golden dataset) to a small tenant slice before full exposure.
- Versioned rollback makes "something just got worse" recoverable in minutes, not a multi-day incident, and gives the eval harness in [[0022-testing-and-evaluation-strategy]] a stable historical record of what changed when.

### Negative
- Shadow evaluation and canary stages add lead time to shipping classification improvements — a genuinely good prompt improvement takes longer to reach 100% of tenants than an unguarded deploy would.
- Maintaining multiple live `pipeline_version`s simultaneously (current + canary + rollback-available) adds operational and cost overhead (e.g., shadow evaluation itself consumes LLM budget — see [[0007-llm-provider-model-tiering-cost-governance]] — for a change that may not even ship).

### Risks
- Shadow evaluation is only as good as the golden dataset and traffic sample it runs against (see [[0022-testing-and-evaluation-strategy]]); a change could pass shadow eval and still regress on a real-world pattern underrepresented in the eval set — mitigated, not eliminated, by the canary stage as a second, real-traffic check.

## Alternatives Considered
- **Direct deploy of prompt/rule changes with no shadow evaluation** — rejected: given classification directly determines how a tenant's real email gets sorted (and in the phishing case, whether it's quarantined — see [[0010-phishing-detection-layering-and-incident-response]]), an unguarded deploy risks visible, trust-damaging regressions with no pre-production signal.
- **Feature-flag-only rollout (no dedicated shadow-evaluation infrastructure)** — rejected as insufficient alone: feature flags control exposure but don't by themselves generate the precision/recall comparison data needed to decide *whether* a change should be promoted; shadow evaluation against the golden dataset is the actual decision input, with canary/flags as the exposure-control mechanism on top of it.

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0008-rule-engine-ownership]], [[0009-prioritization-urgency-scoring-model]], [[0014-feedback-loop-continuous-learning]], [[0015-multi-tenancy-data-isolation]], [[0016-observability-slas-alerting]], [[0022-testing-and-evaluation-strategy]]
