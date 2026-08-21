# 0025. External platform & LLM adapter realism policy

## Status
Accepted

## Date
2026-08-21

## Context
[0003-platform-normalization-layer](0003-platform-normalization-layer.md) established thin per-platform adapters behind a small set of ports (`MailboxSyncPort`, `MailboxWritePort`, `ClassifierPort`, and others) specifically so the rest of the system never depends on Gmail/Graph/Anthropic specifics directly. A post-implementation audit found this abstraction boundary was used to ship adapters that are indistinguishable, at the type level, from real implementations, but do not actually call the external system they claim to integrate with:

- `GmailIngestionAdapter`/`OutlookIngestionAdapter` (`MailboxSyncPort`): `establishWatch` returns a fake `Date.now()`-based id, `fetchMessage` returns a hardcoded sender and subject regardless of input — issue #35.
- `AnthropicClassifierAdapter` (`ClassifierPort`): makes a real `client.messages.create()` call, then discards the response entirely and returns a hardcoded label set — issue #38.
- `ContactsApiAdapter` (Contact Graph): always returns `exists: false` — issue #41.
- `GmailWriteBackAdapter`/`OutlookWriteBackAdapter` (`MailboxWritePort`): use `Math.random() > 0.95` to simulate failures, with a comment noting a real implementation would call the Gmail API — issue #45.

None of these were flagged in code review as stubs; they read as finished, tested adapters. The gap is not a missing handful of integrations — it is that the codebase currently has no way to distinguish "this adapter is real" from "this adapter looks real but isn't" other than reading every adapter's implementation by hand, which is exactly what the audit had to do.

## Decision
- **Production-bound adapters must perform a real call to the named external system.** Any concrete implementation registered as the default provider for a port in a context's `*.module.ts` (i.e., what runs when the app boots outside of tests) must make a real network call — no adapter may return synthesized or hardcoded domain data from that binding.
- **Test doubles are relocated and renamed.** Fakes/stubs move to a `__fakes__/` directory or `*.fake.ts` naming convention, and are wired only via an explicit environment flag (e.g., `MAILBOX_ADAPTER_MODE=fake`) intended for local development and sandboxed testing — never as the module's default provider.
- **CI static-analysis check.** A rule scans files under `infrastructure/adapters/*.adapter.ts` outside `__fakes__/` for suspicious patterns — `Math.random() >` used for control flow, literal email addresses or subject strings returned from a method that takes an id/address parameter, a response variable that is computed and then never read — and fails the build unless the line carries an explicit `// @realism-exempt: <reason>` comment with a named reviewer's sign-off in the PR.
- **Real external-system adapters require an integration test against a sandboxed HTTP layer** (e.g., `nock`/`msw`-style request interception) that asserts the actual outbound request shape and correctly parses a representative real response — satisfying the port's TypeScript interface is necessary but not sufficient.
- **LLM adapters specifically**: discarding a real provider response and returning a constant, as found in `AnthropicClassifierAdapter`, is treated as a functional defect to be fixed with the same priority as a production incident, not as an acceptable interim stub — this directly determines what category a tenant's real email is sorted into.

## Consequences

### Positive
- Makes the fake/real adapter boundary explicit and machine-checkable, rather than something only discoverable by manually reading every adapter, as the audit that surfaced this issue had to do.
- Forces a deliberate, reviewed decision every time a stub adapter is used in a non-test binding, instead of it happening silently as scaffolding that never gets replaced.
- Gives the golden-dataset/shadow-evaluation harness in [0026-golden-dataset-shadow-evaluation-harness](0026-golden-dataset-shadow-evaluation-harness.md) meaningful signal — an eval harness measuring accuracy against a classifier that discards its own LLM response was never going to produce useful numbers.

### Negative
- Slows down legitimate early-phase scaffolding, where a fake adapter is a deliberate, temporary placeholder while a context's domain model is still being built out — every such placeholder now needs an explicit exemption annotation and reviewer sign-off rather than being silently acceptable.
- Requires ongoing tooling investment (the static-analysis rule itself needs maintenance as new adapter patterns emerge).

### Risks
- A regex/AST-based realism check will both over-fire (flagging legitimate constants, e.g., a genuinely fixed API version string) and under-fire (missing a well-disguised stub). It is treated as a review prompt that requires an explicit exemption plus reviewer sign-off to bypass, not an unappealable automatic gate — false positives are handled by exemption, not by weakening the check.
- Retroactively fixing the four adapters identified above will surface further gaps behind them (e.g., real Gmail/Graph calls require the queue topology and rate limiter from issues #36/#37 to actually be safe to run at volume) — this ADR governs adapter realism specifically; the dependent infrastructure work is tracked separately.

## Alternatives Considered
- **Manual code review discipline only, no automated check** — rejected: this is exactly what was relied on previously, and it let four fully-or-partially mocked adapters ship as if complete, undetected until a dedicated audit was run.
- **Ban all fakes/mocks everywhere, including in unit tests** — rejected: unit tests legitimately need fast, deterministic fakes; the actual problem is a fake being silently used as the *production* binding, not fakes existing at all. This decision targets that specific failure mode.
- **Require production adapters to be integration-tested against the live external API in CI** — rejected as the default: real Gmail/Graph/Anthropic calls in every CI run are slow, costly, and subject to the platforms' own rate limits; a sandboxed/mocked HTTP layer test gives the required request/response-shape verification without that cost. Live-API smoke tests remain appropriate in a separate, lower-frequency pipeline.

## Related ADRs
[0003-platform-normalization-layer](0003-platform-normalization-layer.md), [0007-llm-provider-model-tiering-cost-governance](0007-llm-provider-model-tiering-cost-governance.md), [0011-personal-contact-relationship-graph-heuristics](0011-personal-contact-relationship-graph-heuristics.md), [0022-testing-and-evaluation-strategy](0022-testing-and-evaluation-strategy.md), [0026-golden-dataset-shadow-evaluation-harness](0026-golden-dataset-shadow-evaluation-harness.md)
