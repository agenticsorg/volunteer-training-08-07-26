# 0003. Platform integration & normalization layer

## Status
Accepted

## Date
2026-08-07

## Context
Gmail and Microsoft Graph expose meaningfully different mail models (research §1.1, §1.2, §1.3):

| Concept | Gmail | Outlook/Graph |
|---|---|---|
| Organization | Labels (multi-valued) + system category labels (`CATEGORY_*`) | Folders (single location) + `categories` array property |
| Native rules | `users.settings.filters` | `/me/mailFolders/inbox/messageRules` |
| Native priority signal | None (Priority Inbox deprecated) | `inferenceClassification` (Focused/Other, binary) |
| Push | `watch()` + Pub/Sub, ~1 evt/sec/user, requires 7-day renewal | `/subscriptions` webhook, ~3-day max lifetime, no delivery guarantee |
| Reconciliation | `historyId` diff | `/messages/delta` |
| Contacts signal | People API (no interaction-frequency score) | No equivalent explicit signal |

Building classification logic twice — once against each platform's native model — would duplicate the 11-category taxonomy, the rule engine, and every future category addition across two codebases, doubling maintenance and risking behavioral drift between platforms.

## Decision
We will build a **normalization layer** that converts every inbound message, on ingestion, into one internal `NormalizedMessage` envelope (sender, recipients, subject, body parts, headers of interest — `List-Unsubscribe`, `Precedence`, `Auto-Submitted`, `List-Id`, SPF/DKIM/DMARC results — thread/conversation id, timestamps, and platform-specific raw references) per research §5.1 and the architecture diagram in research §6. All Tier 1–3 classification (see [[0005-tiered-classification-pipeline]]) and prioritization scoring (see [[0009-prioritization-urgency-scoring-model]]) operate exclusively against this internal model, never against raw platform payloads. A thin **platform adapter** per side (Gmail adapter, Graph adapter) is responsible only for: (a) translating raw API payloads into `NormalizedMessage`, and (b) translating internal classification output back into platform-native write-back actions (Gmail: `labels.modify`; Outlook: `message.categories` update and/or folder move + importance — research §6 write-back stage). Gmail's native `CATEGORY_*` tab labels and Outlook's `inferenceClassification` are treated as *additional input signals* into the normalized model, not overridden or fought against (research §6, "Key design choices").

## Consequences

### Positive
- Classification, rule engine, and prioritization logic are written once and behave identically regardless of which platform a tenant uses — critical for a product marketed as unified cross-platform triage.
- New platform support (e.g., IMAP-generic, a third provider) in the future only requires a new adapter, not a rewrite of the pipeline.
- Native signals (Gmail tabs, Focused Inbox) are preserved as free input features rather than discarded, improving Tier 1 rule precision at zero cost (research §2.1, §6).

### Negative
- The normalized model is inevitably a lowest-common-denominator abstraction in some places (e.g., Gmail's multi-label model vs. Outlook's single-folder-plus-categories model) — write-back logic must still branch per platform for the *action* even though classification does not.
- Adds one indirection layer that must be kept in sync as either platform's API evolves (e.g., new header semantics, new category types).

### Risks
- If the normalization is too lossy (drops a platform-specific signal that later proves valuable, e.g., Gmail's exact tab-classification confidence), reclassification may be needed. Mitigated by storing raw platform payload references (not full bodies — see [[0013-data-retention-encryption-privacy]]) alongside the normalized envelope for a bounded window, enabling reprocessing without re-fetching.

## Alternatives Considered
- **Platform-specific classification pipelines** (no shared normalization) — rejected: doubles implementation and testing effort for every category and directly risks the platforms' behavior diverging in ways that damage cross-platform product credibility.
- **Adopt a third-party unification SDK** (e.g., Nylas) instead of building adapters against Gmail/Graph directly — considered but rejected for v1: introduces a third vendor dependency and cost layer, and the research's platform-specific findings (webhook reliability caveats, quota specifics, header semantics) were sourced against the native APIs directly, giving us higher confidence building against them than against an abstraction we don't control. May be revisited if a third provider (e.g., IMAP-generic) is added later.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0004-real-time-ingestion-with-delta-sync-backstop]], [[0005-tiered-classification-pipeline]], [[0008-rule-engine-ownership]]
