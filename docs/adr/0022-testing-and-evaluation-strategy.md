# 0022. Testing & evaluation strategy

## Status
Accepted

## Date
2026-08-07

## Context
This system has two fundamentally different kinds of correctness that require different testing strategies. The first is conventional software correctness (does the OAuth flow work, does RLS actually isolate tenants, does the queue retry correctly) — addressable with standard unit/integration/E2E testing. The second is **classification correctness** — does the pipeline actually put messages in the right categories, at the right priority, catching phishing without over-quarantining — which is fundamentally a measurement problem, not a pass/fail assertion problem, because LLM-based classification (Tier 2/3, see [[0005-tiered-classification-pipeline]]) is probabilistic and category boundaries are themselves genuinely ambiguous in places (research §6, open decision #1: Sales & Deals vs. Newsletters vs. Promotions; Social vs. LinkedIn). The research references this need implicitly throughout (e.g., §2.3's cost/accuracy trade-off, §2.5's flagged-as-unvalidated scoring formula) without prescribing a specific eval methodology — this ADR fills that gap.

## Decision
- **Unit/integration/E2E testing** (conventional software correctness): standard test pyramid — unit tests for Tier 1 rule logic (research §2.1's deterministic checks are highly unit-testable: header parsing, `METHOD:CANCEL` detection, schema.org JSON-LD parsing, lookalike-domain string-distance), integration tests for platform adapters (see [[0003-platform-normalization-layer]]) against sandboxed/mocked Gmail and Graph API responses, and E2E tests for critical flows (OAuth connection lifecycle, ingestion → classification → write-back, quarantine/release actions). RLS tenant-isolation is tested explicitly and adversarially (attempt cross-tenant reads/writes in test, expect denial) — treated as a security control requiring dedicated test coverage, not incidental coverage from functional tests (see [[0015-multi-tenancy-data-isolation]]).
- **Classification-accuracy eval harness** (the core addition this ADR establishes): a maintained **golden dataset** of real (de-identified, per [[0013-data-retention-encryption-privacy]]) and synthetic messages, hand-labeled against the 11-category taxonomy plus priority score and phishing status, stratified to deliberately include the boundary-ambiguous cases the research flags (LinkedIn digest containing a job posting; Sales & Deals vs. Newsletter boundary; genuinely ambiguous needs-a-reply cases). Labeling guidelines are written explicitly for the ambiguous boundaries (see [[0006-multi-label-classification-data-model]]) so ground truth itself is consistent across labelers.
- **Tracked metrics**: precision/recall/F1 **per category** (not just an aggregate accuracy number, since research §2.1/§2.4 shows precision varies sharply by category — near-100% for `METHOD:CANCEL` detection, genuinely hard for needs-a-reply), plus phishing-specific metrics tracked separately and more conservatively (false-negative rate on high-confidence quarantine actions is the single most safety-critical number in the system — see [[0010-phishing-detection-layering-and-incident-response]]), plus prioritization-score correlation against labeled ground-truth urgency rankings.
- **Continuous evaluation, not launch-only**: the golden dataset and per-category metrics are the direct input to the shadow-evaluation gate in [[0018-deployment-cicd-safe-rollout]] — every classification-affecting change is scored against this harness before promotion, and metric trends are tracked over time on a dashboard (see [[0016-observability-slas-alerting]]) to catch slow drift, not just discrete regressions from a single change.
- **Golden dataset growth**: confirmed corrections from [[0014-feedback-loop-continuous-learning]] (explicit, high-trust signal; aggregated high-confidence passive signal) are a primary feed into golden-dataset growth over time, closing the loop between production feedback and the eval harness used to gate future changes.
- **Acceptance thresholds**: minimum per-category precision/recall thresholds (higher and non-negotiable for phishing false-negative rate; more tolerant for genuinely ambiguous boundary categories) are defined and enforced as part of the shadow-evaluation gate — a change that regresses a category below its threshold does not promote, regardless of aggregate-accuracy improvement elsewhere.

## Consequences

### Positive
- Per-category metrics (not aggregate accuracy) directly reflect the research's own finding that categories have very different achievable precision (research §2.1 vs. §2.4) — an aggregate number would mask a serious regression in a hard category behind improvement in easy ones.
- Continuous evaluation tied to the shadow-evaluation gate (see [[0018-deployment-cicd-safe-rollout]]) is what makes safe rollout of prompt/rule/weight changes actually possible — without a maintained golden dataset and tracked metrics, "shadow evaluation" would have nothing concrete to evaluate against.
- Explicit, non-negotiable phishing false-negative thresholds encode the asymmetric risk of that category (a missed phishing email is a materially worse outcome than a miscategorized newsletter) directly into the release process, not just as a design principle stated elsewhere.

### Negative
- Building and maintaining a hand-labeled golden dataset with explicit boundary-case labeling guidelines is real, ongoing human effort — not a one-time setup cost, since the taxonomy and edge cases will evolve.
- Per-category threshold enforcement can block a change that's a net aggregate improvement if it regresses one category — a deliberate trade-off (safety/consistency over aggregate optimization) that will occasionally feel like friction to a team eager to ship an improvement.

### Risks
- A golden dataset that isn't kept representative of real, evolving traffic (new spam patterns, new phishing techniques, taxonomy category additions) loses predictive value over time — mitigated by the continuous golden-dataset-growth mechanism above, but requires ongoing attention, not a "build once" mindset.
- Evaluation itself consumes LLM budget (running the golden dataset through Tier 2/3 for every candidate change — see [[0007-llm-provider-model-tiering-cost-governance]]) — an accepted cost of safe rollout, sized into the overall cost model.

## Alternatives Considered
- **Aggregate accuracy only, no per-category breakdown** — rejected: research §2.1 and §2.4 both demonstrate wildly different achievable precision by category; an aggregate number would hide exactly the regressions (in hard categories like needs-a-reply, or safety-critical ones like phishing) that matter most.
- **No formal golden dataset, rely on manual spot-checking before each release** — rejected: not scalable, not reproducible, and provides no objective gate for the automated shadow-evaluation process in [[0018-deployment-cicd-safe-rollout]] — manual spot-checking also cannot reliably catch slow metric drift the way a tracked, versioned dataset can.
- **Single global acceptance threshold instead of per-category, phishing-specific thresholds** — rejected: treats a phishing false negative and a Sales-vs-Newsletter boundary miss as equivalent risk, which they clearly are not; per-category, risk-weighted thresholds better reflect actual product and safety stakes.

## Related ADRs
[[0005-tiered-classification-pipeline]], [[0006-multi-label-classification-data-model]], [[0009-prioritization-urgency-scoring-model]], [[0010-phishing-detection-layering-and-incident-response]], [[0013-data-retention-encryption-privacy]], [[0014-feedback-loop-continuous-learning]], [[0015-multi-tenancy-data-isolation]], [[0016-observability-slas-alerting]], [[0018-deployment-cicd-safe-rollout]]
