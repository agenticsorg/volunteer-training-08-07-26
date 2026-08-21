/**
 * Publish-side routing for the transactional outbox (ADR 0023).
 *
 * Every domain event class in the system MUST have an entry here — even an
 * explicit `[]` for an event with no cross-context consumer today — so
 * `scripts/check-outbox-routing.js` can fail the build the moment a new event
 * class ships with nobody having decided where it goes. Queue names are the
 * consuming bounded context (kebab-case, matching each context's module name
 * and the BULL_QUEUE_NAME convention already used by docker-compose.yml's
 * worker services), not per-event-type queues — one BullMQ queue per
 * consuming context keeps the topology to a manageable, fixed set while still
 * letting the outbox-relay route each event type to exactly the contexts that
 * are "Customer" of it per docs/ddd/context-map.md.
 *
 * `ops-observability` is the catch-all for events with no bounded-context
 * consumer yet (renewal failures, delivery failures, etc.) — always consumed
 * by a logging-only bridge so nothing silently vanishes.
 */

export const QUEUE_NAMES = [
  'mailbox-ingestion',
  'classification',
  'contact-graph',
  'threat-detection',
  'prioritization',
  'mailbox-writeback',
  'feedback-learning',
  'notification-alerting',
  'identity-access',
  'tenant-subscription',
  'ops-observability',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

/**
 * Keyed by the event class's `constructor.name` (see design decision #6 in
 * the ADR 0023-0027 implementation plan: every emit uses `event.constructor.name`
 * as its wire name). Route to `[]` — not by omitting the key — for an event
 * with no cross-context consumer today; the outbox row is still durably
 * written and stays available as an audit record even when unrouted.
 */
export const EVENT_QUEUE_ROUTING: Record<string, QueueName[]> = {
  // mailbox-ingestion (src/mailbox-ingestion/domain/events/message-ingested.event.ts)
  MessageIngestedEvent: ['classification', 'threat-detection', 'contact-graph'],
  MailboxSyncFailedEvent: ['ops-observability'],
  WatchSubscriptionExpiringEvent: ['ops-observability'],

  // contact-graph (src/contact-graph/domain/events/index.ts)
  SenderClassifiedEvent: ['prioritization', 'mailbox-writeback'],
  ContactPromotedToVipEvent: ['prioritization'],
  InteractionFrequencyUpdatedEvent: [], // internal to contact-graph, no other context consumes it

  // identity-access
  MailboxAuthorizedEvent: ['mailbox-ingestion'],
  MailboxCredentialRevokedEvent: ['mailbox-ingestion'],

  // tenant-subscription
  PlanEntitlementsChanged: [], // read synchronously as a Conformist today, not event-consumed
  SubscriptionBillingEventRecorded: [], // billing-internal audit record
  TenantSuspended: ['identity-access'], // cascades to revoke MailboxAuthorizations
  UsageOverageDetected: [], // billing-internal; no bounded context consumes it directly

  // threat-detection (src/threat-detection/domain/events/threat-detection.events.ts)
  MessageThreatAssessed: ['prioritization', 'mailbox-writeback', 'notification-alerting'],
  MessageQuarantined: ['mailbox-writeback', 'notification-alerting'],
  QuarantineOverridden: ['feedback-learning'],

  // prioritization (src/prioritization/domain/events/index.ts)
  MessagePrioritized: ['mailbox-writeback'],
  MessagePriorityEscalated: ['notification-alerting'],

  // mailbox-writeback
  FacetAppliedToPlatform: [], // metered directly to UsageMeter, not consumed by another context
  WriteBackDivergenceDetected: ['feedback-learning'],
  WriteBackFailed: ['ops-observability'],

  // feedback-learning
  ContactSignalReinforced: ['contact-graph'],
  FewShotExampleSetUpdated: ['classification'],
  SenderReputationUpdated: ['classification'],
  TaxonomyVersionBumpTriggered: ['classification'],
  UserCorrectionObserved: [], // feedback-learning's own record of what it observed

  // notification-alerting
  AlertDispatched: [], // metered to UsageMeter; terminal
  DigestGenerated: [], // metered to UsageMeter; terminal
  NotificationDeliveryFailed: ['ops-observability'],
};
