# Architecture Decision Records — Email Sorting System

This directory records the architecture decisions that take the cross-platform (Gmail + Outlook) email triage/classification system from research (`.plans/email-sorting-system-research.md`) to an implementation-ready, enterprise-grade, commercially viable, production SaaS design. Every ADR cites the relevant section(s) of the research report and, where the research flagged an open question, makes the actual decision.

Format: [MADR](https://adr.github.io/madr/)-style — Title, Status, Date, Context, Decision, Consequences (positive/negative/risks), Alternatives Considered, Related ADRs.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-server-side-middleware-saas-architecture.md) | Server-side middleware SaaS architecture | Accepted |
| [0002](0002-technology-stack-selection.md) | Technology stack selection | Accepted |
| [0003](0003-platform-normalization-layer.md) | Platform integration & normalization layer | Accepted |
| [0004](0004-real-time-ingestion-with-delta-sync-backstop.md) | Real-time ingestion strategy: webhook push plus mandatory delta-sync backstop | Accepted |
| [0005](0005-tiered-classification-pipeline.md) | Tiered classification pipeline architecture | Accepted |
| [0006](0006-multi-label-classification-data-model.md) | Multi-label classification data model | Accepted |
| [0007](0007-llm-provider-model-tiering-cost-governance.md) | LLM provider, model tiering & cost governance | Accepted |
| [0008](0008-rule-engine-ownership.md) | Rule engine ownership: native platform rules vs. centrally authoritative | Accepted |
| [0009](0009-prioritization-urgency-scoring-model.md) | Prioritization / urgency scoring model | Accepted |
| [0010](0010-phishing-detection-layering-and-incident-response.md) | Phishing detection layering & incident response policy | Accepted |
| [0011](0011-personal-contact-relationship-graph-heuristics.md) | Personal contact & relationship-graph detection heuristics | Accepted |
| [0012](0012-oauth-token-lifecycle-secrets.md) | OAuth scope minimization, token lifecycle & secrets management | Accepted |
| [0013](0013-data-retention-encryption-privacy.md) | Data retention, encryption & privacy/compliance posture | Accepted |
| [0014](0014-feedback-loop-continuous-learning.md) | Feedback loop & continuous learning | Accepted |
| [0015](0015-multi-tenancy-data-isolation.md) | Multi-tenancy & data isolation architecture | Accepted |
| [0016](0016-observability-slas-alerting.md) | Observability, SLAs & alerting | Accepted |
| [0017](0017-scalability-queueing-autoscaling.md) | Scalability, queueing & autoscaling architecture | Accepted |
| [0018](0018-deployment-cicd-safe-rollout.md) | Deployment topology, CI/CD & safe rollout strategy | Accepted |
| [0019](0019-disaster-recovery-business-continuity.md) | Disaster recovery & business continuity | Accepted |
| [0020](0020-public-internal-api-design.md) | Public/internal API design for client UI and third-party integrations | Accepted |
| [0021](0021-usage-metering-billing.md) | Usage metering & billing integration | Accepted |
| [0022](0022-testing-and-evaluation-strategy.md) | Testing & evaluation strategy | Accepted |

## Open decisions from the research resolved by these ADRs

The research (§6) flagged seven open decisions. Each is resolved by a specific ADR:

1. Category boundary ambiguity (LinkedIn vs. Social, Sales & Deals vs. Newsletters) → [0006](0006-multi-label-classification-data-model.md), [0022](0022-testing-and-evaluation-strategy.md)
2. Multi-label vs. single-label per message → [0006](0006-multi-label-classification-data-model.md)
3. Where phishing sits relative to other categories (quarantine vs. soft flag) → [0010](0010-phishing-detection-layering-and-incident-response.md)
4. Real-time SLA for needs-a-reply / meeting-cancellation → [0016](0016-observability-slas-alerting.md)
5. Build-vs-buy for the rule engine (native vs. central) → [0008](0008-rule-engine-ownership.md)
6. LLM provider/model selection and cost ceiling → [0007](0007-llm-provider-model-tiering-cost-governance.md), [0021](0021-usage-metering-billing.md)
7. Feedback-loop mechanics (passive vs. explicit correction capture) → [0014](0014-feedback-loop-continuous-learning.md)

## Reading order

For a first-time reader: start with 0001–0003 (system shape), then 0004–0011 (the classification pipeline itself), then 0012–0015 (security/privacy/multi-tenancy foundations), then 0016–0019 (operating the system), then 0020–0022 (API, commercial, and quality layers).
