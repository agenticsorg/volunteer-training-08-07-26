import { MessageWriteBackState } from '../domain/aggregates/message-writeback-state.aggregate';
import { FacetApplication } from '../domain/value-objects/facet-application';
import { WriteBackFailureReason } from '../domain/value-objects/writeback-failure-reason';
import { PlatformApplicationStrategy } from '../domain/value-objects/platform-application-strategy';
import {
  FacetAppliedToPlatform,
  WriteBackFailed,
  WriteBackDivergenceDetected,
} from '../domain/events';

describe('Mailbox Write-back / Sync — Stage 8', () => {
  let state: MessageWriteBackState;
  const tenantId = 'tenant-123';
  const mailboxId = 'mailbox-456';
  const messageId = 'msg-789';

  beforeEach(() => {
    state = MessageWriteBackState.create(tenantId, mailboxId, messageId);
  });

  describe('MessageWriteBackState aggregate', () => {
    it('should create aggregate with empty facets', () => {
      expect(state.tenantId).toBe(tenantId);
      expect(state.mailboxId).toBe(mailboxId);
      expect(state.messageId).toBe(messageId);
      expect(state.getAllFacets().size).toBe(0);
    });

    it('should record facet application and publish event', () => {
      const facet = FacetApplication.create('category', {
        category: 'Newsletter',
      });
      state.recordFacetApplication(facet);

      expect(state.getFacet('category')).toBeDefined();
      expect(state.getFacet('category')?.desiredValue.category).toBe(
        'Newsletter',
      );
    });

    it('should apply facet and publish FacetAppliedToPlatform event', () => {
      const now = new Date();
      state.applyFacet('category', { category: 'Social' }, 'gmail', now);

      expect(state.getFacet('category')?.status).toBe('applied');

      const events = state.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(FacetAppliedToPlatform);
      expect((events[0] as FacetAppliedToPlatform).facetType).toBe('category');
      expect((events[0] as FacetAppliedToPlatform).platform).toBe('gmail');
    });

    it('should be idempotent for already-applied facets', () => {
      const now = new Date();

      // First apply
      state.applyFacet('priority', { tier: 'High' }, 'outlook', now);
      expect(state.getDomainEvents()).toHaveLength(1);

      // Clear events
      state.clearDomainEvents();

      // Second apply with same value should not emit event
      state.applyFacet('priority', { tier: 'High' }, 'outlook', now);
      expect(state.getDomainEvents()).toHaveLength(0);
    });

    it('should record facet failure and publish WriteBackFailed event', () => {
      const now = new Date();
      const reason = WriteBackFailureReason.rateLimited();

      state.recordFacetFailure('category', reason, now);

      expect(state.getFacet('category')?.status).toBe('failed');

      const events = state.getDomainEvents();
      const failEvent = events.find(
        (e) => e instanceof WriteBackFailed,
      ) as WriteBackFailed;
      expect(failEvent).toBeDefined();
      expect(failEvent.facetType).toBe('category');
      expect(failEvent.reason.type).toBe('rate_limited');
    });

    it('should increment retry count on consecutive failures', () => {
      const now = new Date();

      state.recordFacetFailure('threat', WriteBackFailureReason.unknown('err1'), now);
      expect(state.getFacet('threat')?.retryCount).toBe(1);

      state.recordFacetFailure('threat', WriteBackFailureReason.unknown('err2'), now);
      expect(state.getFacet('threat')?.retryCount).toBe(2);
    });

    it('should suppress non-threat facets when quarantine is active', () => {
      state.recordFacetApplication(
        FacetApplication.create('threat', { quarantine_locked: true }),
      );

      expect(state.shouldSuppressFacet('category')).toBe(true);
      expect(state.shouldSuppressFacet('priority')).toBe(true);
      expect(state.shouldSuppressFacet('contact')).toBe(true);
      expect(state.shouldSuppressFacet('threat')).toBe(false);
    });

    it('should not suppress facets when quarantine is inactive', () => {
      expect(state.shouldSuppressFacet('category')).toBe(false);
      expect(state.shouldSuppressFacet('priority')).toBe(false);

      state.recordFacetApplication(
        FacetApplication.create('threat', { quarantine_locked: false }),
      );
      expect(state.shouldSuppressFacet('category')).toBe(false);
    });

    it('should detect divergence between expected and observed state', () => {
      const now = new Date();
      const facet = FacetApplication.create('category', {
        category: 'Newsletter',
      });
      facet.withPlatformState({ category: 'Newsletter' });
      state.recordFacetApplication(facet);

      // Simulate user removing the label from platform
      state.detectDivergence('category', { category: null }, now);

      const events = state.getDomainEvents();
      const divergenceEvent = events.find(
        (e) => e instanceof WriteBackDivergenceDetected,
      ) as WriteBackDivergenceDetected;
      expect(divergenceEvent).toBeDefined();
      expect(divergenceEvent.observedState.category).toBeNull();
    });

    it('should not emit divergence event if states match', () => {
      const now = new Date();
      const facet = FacetApplication.create('contact', { personal: true });
      state.recordFacetApplication(facet.withPlatformState({ personal: true }));

      state.detectDivergence('contact', { personal: true }, now);
      expect(state.getDomainEvents()).toHaveLength(0);
    });

    it('should serialize and deserialize facets to/from database', () => {
      state.applyFacet('category', { category: 'Social' }, 'gmail', new Date());
      state.applyFacet('priority', { tier: 'High' }, 'outlook', new Date());

      const db = state.toDb();
      expect(db.category).toBeDefined();
      expect(db.category.desiredValue.category).toBe('Social');
      expect(db.priority.desiredValue.tier).toBe('High');

      const restored = new MessageWriteBackState(
        tenantId,
        mailboxId,
        messageId,
        db,
      );
      expect(restored.getFacet('category')?.status).toBe('applied');
      expect(restored.getFacet('priority')?.status).toBe('applied');
    });

    it('should handle multiple facets independently', () => {
      const now = new Date();

      state.applyFacet('category', { category: 'Ecommerce' }, 'outlook', now);
      state.recordFacetFailure('threat', WriteBackFailureReason.authRevoked(), now);
      state.applyFacet('contact', { personal: true }, 'gmail', now);

      expect(state.getFacet('category')?.status).toBe('applied');
      expect(state.getFacet('threat')?.status).toBe('failed');
      expect(state.getFacet('contact')?.status).toBe('applied');

      const events = state.getDomainEvents();
      expect(events).toHaveLength(3);
    });
  });

  describe('WriteBackFailureReason value object', () => {
    it('should create rate-limited failure with retry-after', () => {
      const reason = WriteBackFailureReason.rateLimited({
        'retry-after': '60',
      });
      expect(reason.type).toBe('rate_limited');
      expect(reason.retryable).toBe(true);
      expect(reason.message).toContain('retry after 60');
    });

    it('should create auth-revoked failure as non-retryable', () => {
      const reason = WriteBackFailureReason.authRevoked();
      expect(reason.type).toBe('auth_revoked');
      expect(reason.retryable).toBe(false);
    });

    it('should create message-deleted failure as non-retryable', () => {
      const reason = WriteBackFailureReason.messageDeleted();
      expect(reason.type).toBe('message_deleted');
      expect(reason.retryable).toBe(false);
    });

    it('should mark 5xx errors as retryable', () => {
      const reason = WriteBackFailureReason.platformError(
        503,
        'Service unavailable',
      );
      expect(reason.retryable).toBe(true);
    });

    it('should mark 4xx non-429 errors as non-retryable', () => {
      const reason = WriteBackFailureReason.platformError(400, 'Bad request');
      expect(reason.retryable).toBe(false);
    });

    it('should serialize to database format', () => {
      const reason = WriteBackFailureReason.rateLimited();
      const db = reason.toDb();
      expect(db.type).toBe('rate_limited');
      expect(db.retryable).toBe(true);
    });
  });

  describe('PlatformApplicationStrategy value object', () => {
    it('should create Gmail default strategy (no folder moves)', () => {
      const strategy = PlatformApplicationStrategy.gmailDefault();
      expect(strategy.platform).toBe('gmail');
      expect(strategy.moveToFolderOnQuarantine).toBe(false);
    });

    it('should create Outlook default strategy (with folder moves on quarantine)', () => {
      const strategy = PlatformApplicationStrategy.outlookDefault();
      expect(strategy.platform).toBe('outlook');
      expect(strategy.moveToFolderOnQuarantine).toBe(true);
      expect(strategy.moveToFolderOnCategory).toBe(false);
    });

    it('should create Outlook category-only strategy', () => {
      const strategy = PlatformApplicationStrategy.outlookCategoryOnly();
      expect(strategy.moveToFolderOnCategory).toBe(false);
      expect(strategy.moveToFolderOnQuarantine).toBe(false);
    });

    it('should create Outlook aggressive strategy (folder moves for all)', () => {
      const strategy = PlatformApplicationStrategy.outlookWithFolderMoves();
      expect(strategy.moveToFolderOnQuarantine).toBe(true);
      expect(strategy.moveToFolderOnCategory).toBe(true);
    });
  });

  describe('FacetApplication value object', () => {
    it('should create pending facet application', () => {
      const facet = FacetApplication.create('category', {
        category: 'Newsletter',
      });
      expect(facet.facetType).toBe('category');
      expect(facet.status).toBe('pending');
      expect(facet.retryCount).toBe(0);
    });

    it('should detect idempotent state when applied value matches platform state', () => {
      const facet = FacetApplication.create('priority', { tier: 'High' });
      const applied = facet.withStatus('applied', new Date());
      const withPlatformState = applied.withPlatformState({ tier: 'High' });

      expect(withPlatformState.isIdempotent()).toBe(true);
    });

    it('should detect non-idempotent when states diverge', () => {
      const facet = FacetApplication.create('category', {
        category: 'Social',
      });
      const applied = facet.withStatus('applied', new Date());
      const withWrongPlatformState = applied.withPlatformState({
        category: 'Newsletter',
      });

      expect(withWrongPlatformState.isIdempotent()).toBe(false);
    });

    it('should track retry count on failures', () => {
      let facet = FacetApplication.create('contact', { personal: true });

      facet = facet.withStatus('failed', new Date());
      expect(facet.retryCount).toBe(1);

      facet = facet.withStatus('failed', new Date());
      expect(facet.retryCount).toBe(2);
    });

    it('should preserve retry count when transitioning to success', () => {
      let facet = FacetApplication.create('threat', {
        quarantine_locked: true,
      });
      facet = facet.withStatus('failed', new Date());
      facet = facet.withStatus('failed', new Date());

      facet = facet.withStatus('applied', new Date());
      expect(facet.retryCount).toBe(2);
      expect(facet.status).toBe('applied');
    });
  });
});
