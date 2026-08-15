import { Injectable, Logger } from '@nestjs/common';
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
 */
@Injectable()
export class CanaryRolloutService {
  private readonly logger = new Logger(CanaryRolloutService.name);

  // Current production version
  private currentProductionVersion: string = 'v1.0.0';

  // Canary version (if any)
  private canaryVersion: string | null = null;

  // Canary rollout percentage (0-100)
  private canaryPercentage: number = 0;

  // Beta tenant IDs that always get canary version
  private betaTenantIds = new Set<string>();

  constructor(private prisma: PrismaService) {
    this.initializeVersionTracking();
  }

  /**
   * Initialize version tracking from database or configuration
   */
  private async initializeVersionTracking(): Promise<void> {
    try {
      // In production, load current and canary versions from a config table
      // or environment variables
      const versionConfig = process.env.PIPELINE_VERSION || 'v1.0.0';
      const canaryConfig = process.env.CANARY_PIPELINE_VERSION || null;
      const canaryPctConfig = process.env.CANARY_PERCENTAGE || '0';

      this.currentProductionVersion = versionConfig;
      this.canaryVersion = canaryConfig;
      this.canaryPercentage = parseInt(canaryPctConfig, 10);

      this.logger.log(
        `Version tracking initialized: prod=${this.currentProductionVersion}, canary=${this.canaryVersion} (${this.canaryPercentage}%)`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize version tracking', error);
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
  promoteCanaryToProduction(): void {
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

    // In production: update database config or publish event
    // await this.configService.updatePipelineVersion(this.currentProductionVersion);
  }

  /**
   * Rollback to previous production version
   * Tied to pipeline_version pointer change, not code revert
   */
  rollbackProduction(previousVersion: string): void {
    this.logger.warn(
      `Rolling back production from ${this.currentProductionVersion} to ${previousVersion}`,
    );

    this.currentProductionVersion = previousVersion;
    this.canaryVersion = null;
    this.canaryPercentage = 0;

    // In production: update database config or publish event
    // await this.configService.updatePipelineVersion(this.currentProductionVersion);
  }

  /**
   * Start new canary rollout with given version and percentage
   */
  startCanaryRollout(canaryVersion: string, startPercentage: number = 5): void {
    if (canaryVersion === this.currentProductionVersion) {
      this.logger.error('Canary version cannot be same as production');
      return;
    }

    this.logger.log(
      `Starting canary rollout: ${canaryVersion} at ${startPercentage}%`,
    );

    this.canaryVersion = canaryVersion;
    this.canaryPercentage = startPercentage;

    // In production: persist config
    // await this.configService.setCanaryRollout(canaryVersion, startPercentage);
  }

  /**
   * Increase canary rollout percentage
   * Called after successful SLI monitoring of previous percentage
   */
  increaseCanaryPercentage(newPercentage: number): void {
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

    // In production: persist config
    // await this.configService.setCanaryPercentage(newPercentage);
  }

  /**
   * Register tenant as beta opt-in
   * Beta tenants always get canary version first
   */
  registerBetaTenant(tenantId: string): void {
    this.betaTenantIds.add(tenantId);
    this.logger.log(`Registered tenant ${tenantId} as beta opt-in`);

    // In production: persist to database
    // await this.configService.addBetaTenant(tenantId);
  }

  /**
   * Unregister tenant from beta program
   */
  unregisterBetaTenant(tenantId: string): void {
    this.betaTenantIds.delete(tenantId);
    this.logger.log(`Unregistered tenant ${tenantId} from beta opt-in`);

    // In production: persist to database
    // await this.configService.removeBetaTenant(tenantId);
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
