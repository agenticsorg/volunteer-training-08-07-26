# 0012. OAuth scope minimization, token lifecycle & secrets management

## Status
Accepted

## Date
2026-08-07

## Context
Research §5.4 gives explicit, high-confidence guidance (sourced from official Google/Microsoft docs plus OAuth security best-practice sources): request the minimal scopes needed — `gmail.modify` + `gmail.labels` rather than the broad `mail.google.com`, and Graph `Mail.ReadWrite` + `MailboxSettings.ReadWrite` rather than `Mail.ReadWrite.All`/application-level access unless truly needed — because "every extra scope both widens breach blast-radius and increases OAuth consent-screen abandonment." Apps requesting sensitive scopes for >100 users require Google's OAuth verification (CASA security assessment for "restricted" scopes touching mail content — research §1.1). Access tokens are short-lived (~1h) by design on both platforms; refresh tokens can be long-lived and must be "store[d] in a managed secrets store, not application DB rows, with rotation" (research §5.4).

## Decision
- **Scope minimization**: request exactly `gmail.modify` + `gmail.labels` for Gmail (delegated, per-user consent), and Graph `Mail.ReadWrite` + `MailboxSettings.ReadWrite` (delegated permissions, not application permissions) for Outlook. `MailboxSettings.ReadWrite` is required for any future native-rule interop but is requested even though [[0008-rule-engine-ownership]] keeps rules centrally, because category/settings write access is still needed for the categories taxonomy. We do **not** request full `mail.google.com`, `Mail.Read.All`/`Mail.ReadWrite.All`, or application-level Graph permissions in v1 — those would require admin consent and materially raise blast radius for no v1 feature that needs them (research §1.2's delegated-vs-application distinction).
- **Consent screen justification**: each requested scope carries a specific, reviewable justification string satisfying Google's OAuth verification/CASA process and Microsoft's admin-consent disclosure requirements — owned as a compliance artifact reviewed alongside [[0013-data-retention-encryption-privacy]].
- **Token storage**: refresh tokens are stored **encrypted at rest in a managed secrets store** (not plain application-database rows) — e.g., a cloud KMS-backed secrets manager — keyed per tenant-mailbox connection, never logged, never returned in any API response. Access tokens (~1h lifetime) are held in memory/short-lived cache only, never persisted.
- **Rotation**: refresh tokens are rotated on every use where the platform supports rotation-on-refresh; all tokens for a mailbox are immediately revoked and re-consent is required on: tenant-initiated disconnect, detected anomalous use, or a security-relevant event (see incident logging in [[0010-phishing-detection-layering-and-incident-response]]).
- **Least-privilege service identity**: the service's own OAuth client credentials (distinct from tenant tokens) are likewise held in the secrets store, separate from tenant refresh tokens, with separate rotation and access-audit trails.

## Consequences

### Positive
- Minimizes both breach blast-radius (a compromised token can only modify labels/categories, never delete/send mail or access unrelated Workspace/M365 resources) and OAuth consent friction, which directly affects tenant onboarding conversion.
- Passing Google's OAuth verification/CASA assessment is a hard prerequisite to operating at >100 users at all — this decision is not optional hardening but a launch-blocking compliance requirement.
- Managed-secrets-store storage with rotation limits the damage window of any single token leak and satisfies the encryption/secrets-handling expectations of enterprise tenants' own security reviews (see [[0013-data-retention-encryption-privacy]]).

### Negative
- Minimal scopes mean any future feature requiring broader access (e.g., sending mail on the tenant's behalf, calendar write access for meeting-cancellation auto-response) requires a new consent flow and re-verification, not a silent capability expansion.
- Managed secrets stores add operational dependency and per-call latency/cost versus reading a token from the application database directly — accepted as the correct trade-off given the sensitivity of the data protected.

### Risks
- Google's OAuth verification process has lead time and can gate launch timelines for scopes touching mail content — must be initiated early in the project timeline, not treated as a pre-launch checklist item.
- Refresh-token compromise, even with rotation, grants a window of mailbox label/category access until detected — mitigated by anomalous-use detection feeding the same incident-logging path as [[0010-phishing-detection-layering-and-incident-response]], and by the immediate-revocation policy above.

## Alternatives Considered
- **Request broad scopes (`mail.google.com`, `Mail.ReadWrite.All`) upfront to avoid future re-consent flows** — rejected: directly contradicts research §5.4's explicit scope-minimization guidance, materially increases breach blast-radius, and would likely fail or significantly slow Google's OAuth verification for a consumer/SMB-facing product.
- **Store tokens encrypted in the application database (application-level encryption) instead of a managed secrets store** — rejected: research §5.4 specifically recommends a managed secrets store over application DB rows; a dedicated secrets manager provides audit trails, access policies, and rotation primitives that application-level encryption alone does not.
- **Application permissions (daemon/service-wide consent) instead of delegated per-user OAuth** — rejected: research §1.2 notes application permissions are higher-blast-radius and require admin consent; delegated per-user consent is the better fit for a product where each tenant user connects their own mailbox.

## Related ADRs
[[0001-server-side-middleware-saas-architecture]], [[0010-phishing-detection-layering-and-incident-response]], [[0013-data-retention-encryption-privacy]], [[0015-multi-tenancy-data-isolation]], [[0019-disaster-recovery-business-continuity]]
