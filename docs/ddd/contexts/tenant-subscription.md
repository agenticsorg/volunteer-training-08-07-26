# Tenant & Subscription Context

## Purpose / responsibility

Tenant & Subscription owns the commercial facts that make this a viable multi-tenant SaaS
rather than a single-user tool: plan definitions, entitlements, usage metering across every
billable dimension the architecture creates (mailboxes connected, messages synced, LLM tokens
spent across all three classification/threat tiers, digests sent), and the billing-relevant
domain events that feed an external billing/payments provider. It exists because the tiered
rules→LLM architecture in research §2.3/§6 has real, variable per-tenant cost (the whole
point of "cheap-first, LLM-as-fallback" is cost control) — this context is what turns that
variable cost into a coherent plan/pricing model and enforces spend ceilings before they
become a billing surprise, per research §6's explicit call to "model expected daily message
volume per user against expected LLM spend before committing."

## Ubiquitous language

- **Plan** — a named commercial tier (e.g., Starter/Growth/Enterprise) defining
  entitlements and pricing.
- **Entitlement** — one specific capped or gated capability under a plan: mailbox count,
  sync-frequency tier, LLM-tier ceiling (may `FrontierLlm` be used at all, and how often),
  custom scoring-weight configuration, retention window.
- **Usage Meter** — a running, per-tenant, per-billing-period counter for one billable
  dimension (messages ingested, LLM tokens by tier, platform writes, digests sent).
- **Overage** — usage beyond an entitlement's included allowance; plan-configurable as either
  hard-capped (feature disabled until next period) or soft-capped (billed as overage).
- **Billing Event** — a domain event with direct billing-system relevance (subscription
  created/changed/canceled, overage crossed, trial expiring).

## Aggregate roots

### `Subscription` (aggregate root)

Identity: `TenantId` (one active subscription per tenant).

Invariants:
- Exactly one `Plan` is active per `Subscription` at a time; plan changes are versioned
  transitions (`PlanChanged`), never in-place mutation of entitlement values, so past usage
  can always be attributed to the entitlement set that was actually in force at the time.
- `Entitlement` values are the single source of truth every other context reads
  (conformist) — Mailbox Ingestion's mailbox-count cap, Classification's `FrontierLlm`
  ceiling, and Identity & Access's application-permission eligibility all derive from this
  aggregate's current `Entitlement` set, never from a locally cached or duplicated copy of
  plan logic.
- A `Subscription` in `PastDue` or `Canceled` status triggers `TenantSuspended` (consumed by
  Identity & Access) only after a configurable grace period — it does not instantly halt
  sync, to avoid data loss/support burden from a transient payment failure.

### `UsageMeter` (aggregate root)

Identity: `(TenantId, MeterType, BillingPeriod)`.

Invariants:
- Meters only increment, and only from a domain event published by the context that actually
  performed the billable action (Mailbox Ingestion for sync volume, Classification for LLM
  token spend, Mailbox Write-back for platform writes, Notification & Alerting for digest
  sends) — `UsageMeter` never estimates or infers usage independently, it is a pure
  accumulator over published facts, keeping this context free of duplicated business logic
  from the contexts it meters.
- Crossing an `Entitlement`'s included allowance raises `UsageOverageDetected` exactly once
  per threshold crossing per billing period (not on every subsequent increment), to avoid
  alert/event storms.

## Entities and value objects

- `Plan` (value object, versioned): `name`, `entitlements: Entitlement[]`, `pricing`.
- `Entitlement` (value object): `dimension` (`MailboxCount | SyncFrequencyTier |
  LlmTierCeiling | CustomScoringWeights | RetentionWindowDays | DigestFrequency`),
  `includedAllowance`, `overagePolicy` (`hardCap | billOverage`).
- `MeterReading` (entity, child of `UsageMeter`): `sourceContext`, `amount`, `recordedAt` —
  kept individually (not just summed) for billing-dispute auditability.
- `BillingPeriod` (value object): `startsAt`, `endsAt`, typically monthly.

## Domain events published

- **`PlanEntitlementsChanged`** — `{ tenantId, planName, entitlements, effectiveAt }`.
  Primary published-language event; consumed (conformist) by Mailbox Ingestion,
  Classification, Prioritization, Identity & Access.
- **`UsageOverageDetected`** — `{ tenantId, meterType, billingPeriod, allowance, actual }`.
  Consumed by Notification & Alerting (tenant-admin-facing alert) and by the metering
  contexts to enforce `hardCap` policy going forward in the period.
- **`TenantSuspended`** — `{ tenantId, reason, suspendedAt }`. Consumed by Identity & Access
  to cascade-revoke mailbox authorizations.
- **`SubscriptionBillingEventRecorded`** — `{ tenantId, eventType (`created | planChanged |
  canceled | trialExpiring | paymentFailed`), occurredAt }`. The integration point toward an
  external billing/payments provider (Stripe-shaped or similar) — this event is what an
  outbound billing-provider ACL translates into actual invoicing calls; that provider
  integration is infrastructure, not modeled as its own bounded context here since it has no
  independent domain logic beyond translating this event stream.

## Repository interfaces (ports)

- `SubscriptionRepository` — load/save by `TenantId`.
- `UsageMeterRepository` — load/save by `(TenantId, MeterType, BillingPeriod)`, with atomic
  increment support to survive concurrent metering writes from multiple source contexts.
- `PlanCatalogRepository` — read-mostly catalog of available `Plan` definitions.

## Anti-corruption layer notes

`BillingProviderAdapter` isolates the external payments/billing platform (subscription
creation, invoice generation, payment-failure webhooks) behind a
`BillingProviderPort` (`createSubscription`, `changePlan`, `recordUsageCharge`,
`handlePaymentWebhook`). Inbound payment-failure webhooks are translated into this context's
own `Subscription` state transitions (`PastDue`) rather than letting a third-party payment
provider's webhook schema leak into the domain model.

## Relationships to other contexts

- **Upstream of Identity & Access, Mailbox Ingestion, Classification, Prioritization**
  (Open Host Service / Published Language for `PlanEntitlementsChanged`; those contexts are
  conformist consumers of entitlement values).
- **Upstream of Identity & Access** specifically for `TenantSuspended` cascading revocation.
- **Downstream of Mailbox Ingestion, Classification, Mailbox Write-back, and Notification &
  Alerting** for usage-metering facts (`MessageIngested` volume, LLM tier escalations,
  `FacetAppliedToPlatform` volume, digest sends) — a pure customer/supplier relationship
  where those contexts are the suppliers of raw usage facts and this context is the sole
  consumer that turns them into billable meters.
