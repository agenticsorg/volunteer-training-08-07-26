import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Canary Rollout Service - implements ADR 0018 safe rollout strategy
 *
 * After passing shadow evaluation, classification-affecting changes are promoted
 * to a small percentage of live tenant traffic with the same SLIs monitored
 * specifically for the canary cohort before full promotion.
 *
 * Classification-affecting changes (rule/prompt/model changes) are tied to
 * pipeline_version; rollback is a version pointer change, not a code revert.
 *
 * State is persisted in CanaryRolloutState table and restored on restart.
 */
@Injectable()
export class CanaryRolloutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CanaryRolloutService.name);

  private currentProductionVersion: string = 'v1.0.0';
  private canaryVersion: string | null = null;
  private canaryPercentage: number = 0;
  private betaTenantIds = new Set<string>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Load persisted state from database
    const rolloutState = await this.prisma.canaryRolloutState.findFirst();

    if (rolloutState) {
      this.currentProductionVersion = rolloutState.productionVersion;
      this.canaryVersion = rolloutState.canaryVersion;
      this.canaryPercentage = rolloutState.canaryPercentage;
      this.betaTenantIds = new Set(rolloutState.betaTenantIds || []);

      this.logger.log(
        `Restored canary rollout state: prod=${this.currentProductionVersion}, canary=${this.canaryVersion} (${this.canaryPercentage}%)`,
      );
    } else {
      // Initialize fresh state in database
      await this.prisma.canaryRolloutState.create({
        data: {
          productionVersion: 'v1.0.0',
          canaryVersion: null,
          canaryPercentage: 0,
          betaTenantIds: [],
        },
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Save state before shutdown
    await this.saveState();
  }

  private async saveState(): Promise<void> {
    try {
      await this.prisma.canaryRolloutState.updateMany({
        data: {
          productionVersion: this.currentProductionVersion,
          canaryVersion: this.canaryVersion,
          canaryPercentage: this.canaryPercentage,
          betaTenantIds: Array.from(this.betaTenantIds),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to persist canary rollout state', error);
    }
  }

  /**
   * Determine which classification pipeline version a tenant should use
   *
   * Resolution order:
   * 1. Opt-in beta tenants always get canary version (if one exists)
   * 2. Random percentage of other tenants (canary rollout slice)
   * 3. Default to production version
   */
  getTenantPipelineVersion(tenantId: string): string {
    // Beta tenants always get canary first
    if (this.betaTenantIds.has(tenantId)) {
      if (this.canaryVersion) {
        this.logger.debug(
          `Tenant ${tenantId} is beta opt-in, using canary version ${this.canaryVersion}`,
        );
        return this.canaryVersion;
      }
    }

    // Random percentage slice for canary rollout
    if (this.canaryVersion && this.canaryPercentage > 0) {
      const hash = this.hashTenantId(tenantId);
      const bucket = hash % 100;

      if (bucket < this.canaryPercentage) {
        this.logger.debug(
          `Tenant ${tenantId} in canary rollout slice, using canary version ${this.canaryVersion}`,
        );
        return this.canaryVersion;
      }
    }

    // Default to production
    return this.currentProductionVersion;
  }

  /**
   * Promote canary version to production
   * Promotes all tenants to the canary version and clears canary state
   */
  async promoteCanaryToProduction(): Promise<void> {
    if (!this.canaryVersion) {
      this.logger.warn('No canary version to promote');
      return;
    }

    this.logger.log(
      `Promoting canary ${this.canaryVersion} to production`,
    );

    this.currentProductionVersion = this.canaryVersion;
    this.canaryVersion = null;
    this.canaryPercentage = 0;

    await this.saveState();
  }

  /**
   * Rollback to previous production version
   * Tied to pipeline_version pointer change, not code revert
   */
  async rollbackProduction(previousVersion: string): Promise<void> {
    this.logger.warn(
      `Rolling back production from ${this.currentProductionVersion} to ${previousVersion}`,
    );

    this.currentProductionVersion = previousVersion;
    this.canaryVersion = null;
    this.canaryPercentage = 0;

    await this.saveState();
  }

  /**
   * Start new canary rollout with given version and percentage
   */
  async startCanaryRollout(
    canaryVersion: string,
    startPercentage: number = 5,
  ): Promise<void> {
    if (canaryVersion === this.currentProductionVersion) {
      this.logger.error('Canary version cannot be same as production');
      return;
    }

    this.logger.log(
      `Starting canary rollout: ${canaryVersion} at ${startPercentage}%`,
    );

    this.canaryVersion = canaryVersion;
    this.canaryPercentage = startPercentage;

    await this.saveState();
  }

  /**
   * Increase canary rollout percentage
   * Called after successful SLI monitoring of previous percentage
   */
  async increaseCanaryPercentage(newPercentage: number): Promise<void> {
    if (!this.canaryVersion) {
      this.logger.warn('No active canary rollout');
      return;
    }

    if (newPercentage > 100) {
      this.logger.error('Percentage cannot exceed 100');
      return;
    }

    this.logger.log(
      `Increasing canary ${this.canaryVersion} from ${this.canaryPercentage}% to ${newPercentage}%`,
    );

    this.canaryPercentage = newPercentage;

    await this.saveState();
  }

  /**
   * Register tenant as beta opt-in
   * Beta tenants always get canary version first
   */
  async registerBetaTenant(tenantId: string): Promise<void> {
    this.betaTenantIds.add(tenantId);
    this.logger.log(`Registered tenant ${tenantId} as beta opt-in`);
    await this.saveState();
  }

  /**
   * Unregister tenant from beta program
   */
  async unregisterBetaTenant(tenantId: string): Promise<void> {
    this.betaTenantIds.delete(tenantId);
    this.logger.log(`Unregistered tenant ${tenantId} from beta opt-in`);
    await this.saveState();
  }

  /**
   * Get current rollout status
   */
  getStatus(): {
    productionVersion: string;
    canaryVersion: string | null;
    canaryPercentage: number;
    betaTenantCount: number;
  } {
    return {
      productionVersion: this.currentProductionVersion,
      canaryVersion: this.canaryVersion,
      canaryPercentage: this.canaryPercentage,
      betaTenantCount: this.betaTenantIds.size,
    };
  }

  /**
   * Hash tenant ID for deterministic but distributed canary bucket assignment
   * Same tenant always gets same version (deterministic)
   * Distribution across buckets is uniform (distributed)
   */
  private hashTenantId(tenantId: string): number {
    let hash = 0;

    for (let i = 0; i < tenantId.length; i++) {
      const char = tenantId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }
}
