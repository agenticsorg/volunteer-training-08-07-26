# Identity & Access Context

## Purpose / responsibility

Identity & Access owns tenant, user, and OAuth credential lifecycle: who can log in, which
mailboxes they've authorized the system to touch, and the scope-minimized, rotated tokens
that make every other context's platform access possible. It is the generic-subdomain
identity backbone of the whole product, implementing the scope-minimization and
token-lifecycle guidance from research §5.4 as concrete domain rules rather than leaving them
as operational best practice scattered across services: request `gmail.modify` +
`gmail.labels` (never broad `mail.google.com`) and Graph `Mail.ReadWrite` +
`MailboxSettings.ReadWrite` (never `Mail.ReadWrite.All` application-level access unless a
tenant's plan genuinely requires service-account/daemon access), store refresh tokens in a
managed secrets store rather than application rows, and rotate on a defined cadence.

## Ubiquitous language

- **Tenant** — the billable organization/account boundary; referenced by `TenantId`
  everywhere in the system as the mandatory partition key.
- **User** — a human who authenticates into the product on behalf of a tenant; may own one or
  more `MailboxAuthorization`s.
- **Mailbox Authorization** — the OAuth grant linking one `User` to one platform mailbox,
  scoped to the minimal permission set that context needs.
- **Scope Set** — the exact list of OAuth scopes requested/held for a
  `MailboxAuthorization`; a first-class, auditable value, not an opaque token property.
- **Credential** — the access/refresh token pair backing a `MailboxAuthorization`; access
  tokens are short-lived (~1h) by platform design, refresh tokens are long-lived and rotated.
- **Consent Grant** — the record of what the user was told and agreed to at OAuth
  consent-screen time, kept for audit and re-consent-on-scope-change purposes.

## Aggregate roots

### `Tenant` (aggregate root — identity-facing projection; Tenant & Subscription owns the
commercial facts about the same `TenantId`)

Identity: `TenantId`.

Invariants:
- A `Tenant` must exist before any `User` can be created under it.
- Tenant status (`active | suspended | deleted`) gates whether any `MailboxAuthorization`
  under it may be used to sync — Identity & Access enforces this at the credential-issuance
  boundary regardless of what Tenant & Subscription's billing state says, so a suspended
  tenant's mailboxes stop syncing immediately rather than waiting for a billing sweep.

### `MailboxAuthorization` (aggregate root)

Identity: `(TenantId, UserId, MailboxId)`.

Invariants:
- `ScopeSet` can never exceed the minimal set required for the mailbox's active features —
  requesting `mail.google.com` or `Mail.ReadWrite.All` is disallowed by construction unless a
  tenant's plan is explicitly flagged as requiring application-level/daemon access (research
  §1.2's delegated-vs-application-permissions distinction), and that flag itself lives in
  Tenant & Subscription, read here as a conformist input.
- A `Credential`'s refresh token is never persisted in the same store as any other domain
  data — this aggregate holds only a reference/handle into a managed secrets store, never the
  raw refresh token value, so a database compromise alone cannot exfiltrate live tokens.
- Access-token refresh is fully automatic and internal; a `MailboxAuthorization` only
  transitions to `Revoked` on an explicit user/tenant-admin action or a platform-reported
  invalidation (user revoked consent at Google/Microsoft's end) — it never silently expires
  into a broken state without raising `MailboxCredentialRevoked`.
- Every `ScopeSet` change requires a fresh `ConsentGrant` — scopes cannot be silently widened
  on an existing authorization without new, explicit user consent.

## Entities and value objects

- `ConsentGrant` (entity, child of `MailboxAuthorization`): `scopesGranted`, `grantedAt`,
  `consentScreenVersion` (which exact justification text the user saw).
- `CredentialHandle` (value object): an opaque reference into the managed secrets store —
  never the token itself — plus `accessTokenExpiresAt`, `lastRotatedAt`.
- `ScopeSet` (value object): the ordered, minimal list of platform scopes; equality-comparable
  so scope-widening attempts are detectable.
- `User` (entity, child of `Tenant`): `email`, `role` (`owner | admin | member`),
  `authorizedMailboxes: MailboxId[]`.

## Domain events published

- **`MailboxAuthorized`** — `{ tenantId, userId, mailboxId, platform, scopeSet,
  authorizedAt }`. Triggered on successful OAuth grant completion; the trigger Mailbox
  Ingestion waits on before establishing its first sync.
- **`CredentialRotated`** — `{ tenantId, mailboxId, rotatedAt }`. Internal-facing, mostly for
  audit; does not change scope or grant state.
- **`MailboxCredentialRevoked`** — `{ tenantId, mailboxId, reason (`userRevoked |
  platformInvalidated | adminRevoked | tenantSuspended`), revokedAt }`. Triggered on any
  path to an unusable credential; the signal Mailbox Ingestion consumes to halt syncing
  immediately.
- **`TenantSuspended`** — `{ tenantId, suspendedAt, reason }`. Triggered when Tenant &
  Subscription reports a billing/policy suspension; cascades internally to revoke active
  mailbox authorizations under that tenant.

## Repository interfaces (ports)

- `TenantRepository` — load/save by `TenantId` (identity-facing fields only).
- `UserRepository` — load/save by `UserId`, query by `TenantId`.
- `MailboxAuthorizationRepository` — load/save by `(TenantId, UserId, MailboxId)`.
- `SecretsVaultPort` — store/retrieve/rotate token material by `CredentialHandle`, backed by
  a managed secrets store (e.g., a KMS-backed vault), never a plain database table.

## Anti-corruption layer notes

Two adapters — `GoogleOAuthAdapter` and `MicrosoftIdentityAdapter` — implement one
`OAuthProviderPort` (`initiateConsent`, `exchangeCode`, `refreshToken`, `revoke`), isolating:
- Google's OAuth 2.0 + CASA security-assessment requirement for sensitive/restricted scopes
  serving >100 users, versus Microsoft's delegated-vs-application-permission model and
  admin-consent flow for application permissions.
- Differing token expiry semantics and revocation-check endpoints per provider.
- Differing consent-screen scope-string formats, normalized into this context's own
  `ScopeSet` value object so nothing above the ACL ever compares a Google scope string against
  a Microsoft Graph permission string directly.

## Relationships to other contexts

- **Upstream of every mailbox-touching context** (Mailbox Ingestion directly; Mailbox
  Write-back indirectly via Ingestion's `MailboxConnection`) — Open Host Service / Published
  Language for `MailboxAuthorized` / `MailboxCredentialRevoked`; nothing syncs without a live
  authorization from here.
- **Downstream of Tenant & Subscription** (conformist) — reads `PlanEntitlements` for
  application-vs-delegated permission eligibility and tenant suspension state; does not own
  billing facts itself.
- **Upstream of Notification & Alerting** — supplies the authorized notification channel
  (which user, which contact method) so alerts aren't sent to unauthorized recipients.
