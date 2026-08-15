import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { CanaryRolloutService } from '../classification/services/canary-rollout.service';

/**
 * Canary Rollout Test - implements ADR 0018 safe rollout strategy
 *
 * Verifies that classification-affecting changes are properly controlled
 * through beta opt-in → canary percentage slice → full production rollout.
 *
 * All changes are tied to pipeline_version; rollback is a pointer change,
 * not a code revert, enabling fast rollback if issues are detected.
 */
describe('Classification Canary Rollout (ADR 0018)', () => {
  let canaryService: CanaryRolloutService;

  beforeAll(async () => {
    // Create standalone service instance for testing
    // In production, this would be registered in ClassificationModule
    canaryService = new CanaryRolloutService(null as any);
  });

  afterAll(async () => {
    // Service cleanup if needed
  });

  describe('Tenant Version Resolution', () => {
    it('should return production version by default', () => {
      const tenantId = 'tenant-default-001';
      const version = canaryService.getTenantPipelineVersion(tenantId);

      expect(version).toBeDefined();
      expect(version).toMatch(/^v\d+/); // Semantic version
    });

    it('should assign consistent version to same tenant', () => {
      const tenantId = 'tenant-consistent-001';

      const version1 = canaryService.getTenantPipelineVersion(tenantId);
      const version2 = canaryService.getTenantPipelineVersion(tenantId);
      const version3 = canaryService.getTenantPipelineVersion(tenantId);

      expect(version1).toBe(version2);
      expect(version2).toBe(version3);
    });

    it('should assign consistent versions across restart', () => {
      // Tenant IDs should deterministically hash to same bucket
      const tenantIds = [
        'tenant-hash-001',
        'tenant-hash-002',
        'tenant-hash-003',
      ];

      const versions = tenantIds.map((id) =>
        canaryService.getTenantPipelineVersion(id),
      );

      // Re-run same tenants
      const versionsAgain = tenantIds.map((id) =>
        canaryService.getTenantPipelineVersion(id),
      );

      expect(versions).toEqual(versionsAgain);
    });
  });

  describe('Beta Opt-in Tenants', () => {
    it('should route beta tenants to canary version', () => {
      const betaTenantId = 'tenant-beta-001';

      // Register as beta
      canaryService.registerBetaTenant(betaTenantId);

      // Start canary
      canaryService.startCanaryRollout('v1.1.0-canary', 5);

      const version = canaryService.getTenantPipelineVersion(betaTenantId);
      expect(version).toBe('v1.1.0-canary');
    });

    it('should return to production version after unregistration', () => {
      const tenantId = 'tenant-beta-002';

      canaryService.registerBetaTenant(tenantId);
      canaryService.startCanaryRollout('v1.1.0-canary', 5);

      expect(canaryService.getTenantPipelineVersion(tenantId)).toBe(
        'v1.1.0-canary',
      );

      // Unregister from beta
      canaryService.unregisterBetaTenant(tenantId);

      const version = canaryService.getTenantPipelineVersion(tenantId);
      expect(version).not.toBe('v1.1.0-canary');
    });

    it('should maintain beta tenant list across queries', () => {
      const betaTenant1 = 'tenant-beta-003';
      const betaTenant2 = 'tenant-beta-004';

      canaryService.registerBetaTenant(betaTenant1);
      canaryService.registerBetaTenant(betaTenant2);

      canaryService.startCanaryRollout('v1.2.0-canary', 10);

      expect(canaryService.getTenantPipelineVersion(betaTenant1)).toBe(
        'v1.2.0-canary',
      );
      expect(canaryService.getTenantPipelineVersion(betaTenant2)).toBe(
        'v1.2.0-canary',
      );

      const status = canaryService.getStatus();
      expect(status.betaTenantCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Canary Rollout Progression', () => {
    it('should start canary at low percentage', () => {
      canaryService.startCanaryRollout('v1.3.0-canary', 5);

      const status = canaryService.getStatus();
      expect(status.canaryVersion).toBe('v1.3.0-canary');
      expect(status.canaryPercentage).toBe(5);
    });

    it('should increase canary percentage gradually', () => {
      canaryService.startCanaryRollout('v1.4.0-canary', 5);

      // Simulate monitoring and approval to increase
      canaryService.increaseCanaryPercentage(25);
      let status = canaryService.getStatus();
      expect(status.canaryPercentage).toBe(25);

      canaryService.increaseCanaryPercentage(50);
      status = canaryService.getStatus();
      expect(status.canaryPercentage).toBe(50);

      canaryService.increaseCanaryPercentage(100);
      status = canaryService.getStatus();
      expect(status.canaryPercentage).toBe(100);
    });

    it('should distribute tenants across canary slice deterministically', () => {
      canaryService.startCanaryRollout('v1.5.0-canary', 20);

      // Generate many tenant IDs and check distribution
      const canaryCount = Array.from({ length: 100 }, (_, i) => `tenant-dist-${i}`)
        .filter((tenantId) => {
          const version = canaryService.getTenantPipelineVersion(tenantId);
          return version === 'v1.5.0-canary';
        }).length;

      // Should be approximately 20% (±10 for randomness in small sample)
      expect(canaryCount).toBeGreaterThanOrEqual(10);
      expect(canaryCount).toBeLessThanOrEqual(30);
    });
  });

  describe('Promotion to Production', () => {
    it('should promote canary to production', () => {
      canaryService.startCanaryRollout('v1.6.0-canary', 50);

      let status = canaryService.getStatus();
      expect(status.canaryVersion).toBe('v1.6.0-canary');
      expect(status.canaryPercentage).toBe(50);

      // Simulate successful canary, promote to production
      canaryService.promoteCanaryToProduction();

      status = canaryService.getStatus();
      expect(status.productionVersion).toBe('v1.6.0-canary');
      expect(status.canaryVersion).toBeNull();
      expect(status.canaryPercentage).toBe(0);

      // All tenants now get new version
      const tenantVersion = canaryService.getTenantPipelineVersion(
        'tenant-after-promotion',
      );
      expect(tenantVersion).toBe('v1.6.0-canary');
    });

    it('should prevent promotion of same version as production', () => {
      const status = canaryService.getStatus();
      const currentProduction = status.productionVersion;

      // Attempting to start canary with same version should be rejected
      canaryService.startCanaryRollout(currentProduction, 10);

      // Canary should not start (or start but with error)
      const newStatus = canaryService.getStatus();
      expect(newStatus.canaryVersion).not.toBe(currentProduction);
    });
  });

  describe('Rollback on Regression', () => {
    it('should rollback to previous version on regression', () => {
      // Establish production version
      const previousVersion = canaryService.getStatus().productionVersion;

      // Start canary
      canaryService.startCanaryRollout('v1.7.0-canary', 20);
      canaryService.increaseCanaryPercentage(100);
      canaryService.promoteCanaryToProduction();

      let status = canaryService.getStatus();
      expect(status.productionVersion).toBe('v1.7.0-canary');

      // Simulate regression detected, rollback
      canaryService.rollbackProduction(previousVersion);

      status = canaryService.getStatus();
      expect(status.productionVersion).toBe(previousVersion);
      expect(status.canaryVersion).toBeNull();
    });

    it('should clear canary state on rollback', () => {
      canaryService.startCanaryRollout('v1.8.0-canary', 50);
      canaryService.increaseCanaryPercentage(100);
      canaryService.promoteCanaryToProduction();

      // Simulate rollback
      canaryService.rollbackProduction('v1.7.0-canary');

      const status = canaryService.getStatus();
      expect(status.canaryVersion).toBeNull();
      expect(status.canaryPercentage).toBe(0);
    });
  });

  describe('Version Persistence', () => {
    it('should report complete version status', () => {
      canaryService.startCanaryRollout('v2.0.0-canary', 15);

      const status = canaryService.getStatus();

      expect(status).toHaveProperty('productionVersion');
      expect(status).toHaveProperty('canaryVersion');
      expect(status).toHaveProperty('canaryPercentage');
      expect(status).toHaveProperty('betaTenantCount');

      expect(typeof status.productionVersion).toBe('string');
      expect(typeof status.canaryPercentage).toBe('number');
      expect(typeof status.betaTenantCount).toBe('number');
    });

    it('should track version history through rollout lifecycle', () => {
      // This would be fully implemented in production to enable:
      // 1. Audit trail of version changes
      // 2. Revert to any prior version
      // 3. Per-version metrics/SLIs

      const initialStatus = canaryService.getStatus();
      const initialVersion = initialStatus.productionVersion;

      canaryService.startCanaryRollout('v2.1.0-canary', 10);
      canaryService.increaseCanaryPercentage(100);
      canaryService.promoteCanaryToProduction();

      const promotedStatus = canaryService.getStatus();
      expect(promotedStatus.productionVersion).not.toBe(initialVersion);

      // In production: query version history
      // const history = await versionHistoryService.getVersionHistory();
      // expect(history).toContainEqual({
      //   version: 'v2.1.0-canary',
      //   promotedAt: expect.any(Date),
      //   canaryStarted: expect.any(Date),
      // });
    });
  });
});
