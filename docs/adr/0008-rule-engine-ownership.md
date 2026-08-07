# 0008. Rule engine ownership: native platform rules vs. centrally authoritative

## Status
Accepted

## Date
2026-08-07

## Context
Both platforms expose native, first-class rule engines: Gmail's `users.settings.filters` (sender/subject/keyword match → label/forward/mark-read actions) and Outlook's `/me/mailFolders/inbox/messageRules` (sender/subject/keyword match → move/categorize/set-importance/forward/stop-processing actions) — research §1.1, §1.2. The research flags this as an explicit open decision (research §6, open decision #5): "decide whether to push simple rules into the platforms' own rule engines... vs. keep all rules in your own service (more control, more to build)." Pushing rules natively means less infrastructure to run and rules that apply even if our service is briefly down; keeping rules centrally means one auditable, versioned, cross-platform-consistent source of truth.

## Decision
**All classification rule logic (Tier 1 of [[0005-tiered-classification-pipeline]]) remains centrally authoritative in our service.** We do not delegate any part of the 11-category taxonomy's rule logic to Gmail filters or Outlook message rules. Native platform rule engines are used only for one narrow purpose: **write-back label/category/folder application that mirrors a decision our pipeline already made**, and even that is done via direct API calls (`labels.modify`, `message.categories` update, folder move) rather than by provisioning native filter/rule objects that would then run independently of our pipeline.

Rationale, weighing the research's own framing of the trade-off:
- **Auditability and consistency** dominate for a commercial multi-tenant product: every classification decision must be explainable, versioned, and evaluable against the golden dataset (see [[0022-testing-and-evaluation-strategy]]) and reproducible for support/compliance purposes (see [[0013-data-retention-encryption-privacy]]). Native filters are opaque to us once created — we cannot version, eval, or roll them back the way we can our own rule engine.
- **Cross-platform consistency** is the product's core value proposition (see [[0001-server-side-middleware-saas-architecture]]); splitting rule logic between two divergent native engines (different condition grammars, different action sets) directly undermines "one taxonomy, two platforms."
- **Safe rollout** (canary/shadow evaluation, see [[0018-deployment-cicd-safe-rollout]]) is only possible for logic we control end-to-end; a native filter change is immediate and unversioned.
- The "less infrastructure, still works if our service is briefly down" argument for native rules is real but is better addressed by our own reliability investment (see [[0016-observability-slas-alerting]], [[0019-disaster-recovery-business-continuity]]) than by fragmenting classification logic.

## Consequences

### Positive
- One place to reason about, test, version, and audit every rule — required for the eval harness (research §6 open decision #6) and for compliance/support explainability.
- Rule changes ship through the same canary/shadow-evaluation pipeline as LLM prompt changes (see [[0018-deployment-cicd-safe-rollout]]), so a bad rule change is caught before full rollout instead of silently misfiling mail for every tenant who has that native filter.
- No risk of native filters and our pipeline disagreeing or double-processing a message (e.g., a native filter moving a message before our pipeline sees it, corrupting the normalized envelope).

### Negative
- If our service has an outage, no classification/rule application happens at all — there is no native-filter fallback keeping basic sorting alive. This raises the bar on the availability targets in [[0016-observability-slas-alerting]] and [[0019-disaster-recovery-business-continuity]].
- We forgo the "zero infrastructure" simplicity of native rules for the small subset of rules that are genuinely static and would rarely change (e.g., "mail from *.linkedin.com → LinkedIn label").

### Risks
- Tenants may have pre-existing native filters/rules from before onboarding that conflict with our write-back actions (e.g., a native filter auto-archiving mail our pipeline is trying to label). Mitigated by an onboarding step that surfaces existing native rules to the tenant and flags likely conflicts, rather than silently overriding them.

## Alternatives Considered
- **Delegate simple, stable rules to native engines, keep only complex/ambiguous logic centrally** — this is the "less infra" option the research presents as viable (research §6 open decision #5). Rejected as the default because it fragments auditability and rollout safety for a marginal infra saving, and because "simple, stable" rules are exactly the ones cheapest to run centrally at Tier 1 anyway (research §2.1 — these are the near-$0, millisecond rules). May be offered later as an opt-in tenant convenience (e.g., "also mirror this rule as a native Gmail filter for offline resilience"), but never as a substitute for central evaluation.
- **Fully delegate to native engines, use our pipeline only for what native rules cannot express (LLM tiers)** — rejected: undermines cross-platform consistency, the core product differentiator, and makes the rule layer unauditable and unversioned.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0003-platform-normalization-layer]], [[0005-tiered-classification-pipeline]], [[0018-deployment-cicd-safe-rollout]], [[0022-testing-and-evaluation-strategy]]
