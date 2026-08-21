# 0027. Real KMS-backed secrets vault

## Status
Accepted

## Date
2026-08-21

## Context
[0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md) requires that OAuth refresh tokens be held only via a `CredentialHandle` reference into a managed, KMS-backed secrets store — never as a raw token in an application database row — and that Stage 2's Done criteria include a security-review checklist confirming no raw token ever appears in a database row, log line, or API response.

An audit of the running codebase found `SecretsVaultPort` is currently bound only to `MockSecretsVaultAdapter` (issue #34); no real KMS-backed implementation exists. This means the "no raw token ever persisted" claim is currently true only as an accident of the mock being in-memory, not because the real path was ever built and verified — the actual security property [0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md) requires is unverified against a real backend. This is a narrower, more security-critical instance of the general fake-adapter-in-production problem addressed by [0025-external-adapter-realism-policy](0025-external-adapter-realism-policy.md), and warrants its own decision given the sensitivity of the data involved — this vault is the sole thing standing between a database compromise and every tenant's live mailbox access.

## Decision
- **Implement a real `SecretsVaultPort` adapter** backed by a managed, KMS-backed secrets manager. The final vendor (cloud provider secrets manager vs. HashiCorp Vault) is deferred to deployment environment per [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md)'s isolated-instance option for enterprise tenants, but the adapter contract is fixed now: `store(tenantId, mailboxId, token) -> CredentialHandle`, `resolve(handle) -> token`, `revoke(handle)`.
- **`MockSecretsVaultAdapter` is retained but reclassified** as a test/dev-only fake per [0025-external-adapter-realism-policy](0025-external-adapter-realism-policy.md)'s fake/real adapter separation, wired only under an explicit `SECRETS_VAULT_MODE=mock` environment flag. The application refuses to boot with that flag set when `NODE_ENV=production`.
- **`CredentialHandle` values are opaque, non-guessable references** — not derived from the raw token, and not reversible without vault access. A startup smoke check scans persisted `MailboxAuthorization` rows for values that look like a raw OAuth token by shape/length heuristic, failing loudly if one is found; this is a defense-in-depth sanity check, not a substitute for the full security review the Stage 2 Done criteria already require.
- **Every `resolve()` call is logged** with tenant id, mailbox id, and caller identity, per the observability posture in [0016-observability-slas-alerting](0016-observability-slas-alerting.md), so vault access is independently auditable rather than an unlogged internal call.
- **Secrets-store replication** is included in the disaster-recovery failover plan already called for by [0019-disaster-recovery-business-continuity](0019-disaster-recovery-business-continuity.md)/Stage 12 — this ADR is the prerequisite that makes that replication meaningful, since there is currently no real vault to replicate.

## Consequences

### Positive
- Closes the Stage 2 security-review Done criterion for real, against an actual backend, instead of leaving it true only because the mock happens to be in-memory.
- Removes the single largest unverified security claim in the current implementation.
- Makes vault access independently auditable, supporting incident response if a credential is ever suspected of being compromised.

### Negative
- Introduces a real external dependency (the vault provider) with its own availability and latency characteristics that the OAuth grant/refresh/revoke flows in [0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md) must now account for.
- Adds per-token-access logging volume that must be accounted for in the observability pipeline's cost and retention posture.

### Risks
- **Fail-closed on vault unavailability**: refusing to boot in production without a real vault, and failing OAuth operations if the vault is unreachable at runtime, is a deliberately strict trade-off given the sensitivity of the data — not an oversight — but it means a vault outage can halt new mailbox authorizations and credential refreshes. This must be explicitly monitored and paged on (per [0016-observability-slas-alerting](0016-observability-slas-alerting.md)) so a vault outage is visible as its own incident class, not silently indistinguishable from unrelated ingestion failures.

## Alternatives Considered
- **Application-DB envelope-encrypted column storage of tokens**, instead of a separate vault service — rejected: [0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md) explicitly requires a managed secrets store distinct from application DB rows, both to limit the blast radius of a database compromise and to get built-in rotation/audit primitives that a hand-rolled encrypted column would have to reimplement and independently verify.
- **Continue with the mock indefinitely, treating it as acceptable for the current stage of the product** — rejected: this leaves the OAuth token lifecycle's core security promise — the one explicitly called out in [0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md) — unverified against a real backend, which is not an acceptable posture for a production SaaS handling real users' live mailbox credentials.

## Related ADRs
[0012-oauth-token-lifecycle-secrets](0012-oauth-token-lifecycle-secrets.md), [0013-data-retention-encryption-privacy](0013-data-retention-encryption-privacy.md), [0015-multi-tenancy-data-isolation](0015-multi-tenancy-data-isolation.md), [0016-observability-slas-alerting](0016-observability-slas-alerting.md), [0018-deployment-cicd-safe-rollout](0018-deployment-cicd-safe-rollout.md), [0019-disaster-recovery-business-continuity](0019-disaster-recovery-business-continuity.md), [0025-external-adapter-realism-policy](0025-external-adapter-realism-policy.md)
