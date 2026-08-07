# 0001. Server-side middleware SaaS architecture

## Status
Accepted

## Date
2026-08-07

## Context
The system must classify and triage email across both Gmail and Outlook for many paying tenants, applying a shared 11-category taxonomy plus a priority score. The research (per research §5.1) evaluated three integration surfaces:

1. **Client add-ins** (Gmail Add-on / Apps Script, Outlook Add-in / Office.js) — run inside the native client, but are two separate codebases/runtimes, are largely interaction-triggered rather than continuously-running, and are poorly suited to background batch classification of an entire inbox.
2. **Server-side middleware** (OAuth + REST API service) — a single backend serves both platforms behind one internal model, runs continuously via poll/webhook, and can host heavy classification (including LLM calls) entirely server-side.
3. **Local/desktop background agent** — no hosting cost and a privacy advantage, but is hard to keep running reliably, complicates multi-device sync, and still requires OAuth regardless of "local" framing.

The research explicitly recommends option 2 (research §5.1): "given the requirement to support both Gmail and Outlook with a shared 11-category taxonomy, a server-side middleware service is the clear fit." This ADR formalizes that recommendation as a binding architectural decision for a commercial, multi-tenant product, not a prototype.

## Decision
We will build the product as a **server-side middleware SaaS**: a backend service that authenticates via OAuth to each tenant's Gmail and/or Outlook account(s), ingests mail via webhook + delta-sync (see [[0004-real-time-ingestion-with-delta-sync-backstop]]), classifies it through a tiered pipeline (see [[0005-tiered-classification-pipeline]]), and writes results back via each platform's native labeling/foldering primitives (see [[0003-platform-normalization-layer]]). There is no thick client, desktop agent, or native add-in in the v1 architecture. A thin web UI (see [[0020-public-internal-api-design]]) is a consumer of the same backend APIs used internally.

## Consequences

### Positive
- One classification pipeline, one deployment, one place to reason about cost, latency, and correctness — instead of duplicating logic across Apps Script and Office.js runtimes.
- Enables continuous background processing (polling, webhook consumption, batch LLM jobs) that add-in runtimes cannot reliably support.
- Straightforward to scale horizontally as a conventional web service (see [[0017-scalability-queueing-autoscaling]]).
- Keeps the door open for a future add-in as a *thin* UI layer on top of the same backend, without re-architecting classification.

### Negative
- We own OAuth token lifecycle, webhook subscription renewal, and infrastructure costs that a pure client-side add-in would avoid (see [[0012-oauth-token-lifecycle-secrets]]).
- Full email content transits and (transiently) is processed by our infrastructure, raising the privacy/compliance bar substantially (see [[0013-data-retention-encryption-privacy]]).
- No offline/local-only mode; the product is unusable if our service is down (mitigated by [[0019-disaster-recovery-business-continuity]]).

### Risks
- Because we sit between the user and their inbox, any bug in write-back logic (mislabeling, wrong folder move) is directly visible and trust-damaging; requires strong test/eval coverage (see [[0022-testing-and-evaluation-strategy]]) and safe rollout gates (see [[0018-deployment-cicd-safe-rollout]]).

## Alternatives Considered
- **Gmail Add-on + Outlook Add-in (native client extensions)** — rejected as the primary architecture because they cannot run continuous background triage across an entire inbox and would require maintaining two incompatible codebases for the same classification logic (research §5.1).
- **Local/desktop background agent** — rejected for a commercial multi-tenant product: reliability (surviving sleep/reboot), multi-device state sync, and OAuth requirements erase most of the claimed "local" privacy benefit, while making SLA commitments (see [[0016-observability-slas-alerting]]) unenforceable (research §5.1).

## Related ADRs
[[0002-technology-stack-selection]], [[0003-platform-normalization-layer]], [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0015-multi-tenancy-data-isolation]], [[0020-public-internal-api-design]]
