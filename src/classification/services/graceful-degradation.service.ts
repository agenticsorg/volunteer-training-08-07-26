import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Graceful Degradation Service - implements ADR 0019 disaster recovery
 *
 * On sustained Anthropic API outage, the classification pipeline falls back
 * to Tier-1-rules-only (lower coverage, not zero coverage) rather than halting.
 * This preserves partial product value during a dependency outage.
 *
 * When LLM provider is unavailable:
 * - Messages that receive strong Tier-1 rule signals continue to be classified
 * - Messages requiring LLM classification are marked as degraded/pending
 * - No messages are silently misclassified
 */
@Injectable()
export class GracefulDegradationService {
  private readonly logger = new Logger(GracefulDegradationService.name);

  // Track LLM provider health
  private llmProviderHealthy = true;
  private lastLlmFailure: Date | null = null;
  private consecutiveFailures = 0;
  private readonly FAILURE_THRESHOLD = 5; // Trigger degradation after 5 consecutive failures
  private readonly DEGRADATION_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown before retry

  constructor(private prisma: PrismaService) {
    // Periodically check LLM provider health
    this.startHealthCheck();
  }

  /**
   * Record LLM provider failure
   * Triggers degraded mode after threshold is reached
   */
  recordLlmFailure(error: Error): void {
    this.consecutiveFailures++;
    this.lastLlmFailure = new Date();

    this.logger.warn(
      `LLM provider failure (${this.consecutiveFailures}/${this.FAILURE_THRESHOLD}): ${error.message}`,
    );

    if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      this.logger.error(
        `LLM provider degraded mode triggered after ${this.FAILURE_THRESHOLD} consecutive failures`,
      );
      this.llmProviderHealthy = false;
      this.emitDegradationAlert();
    }
  }

  /**
   * Record successful LLM provider call
   * Resets failure counter and restores normal mode
   */
  recordLlmSuccess(): void {
    if (!this.llmProviderHealthy) {
      this.logger.log('LLM provider recovered, exiting degraded mode');
      this.emitRecoveryAlert();
    }

    this.consecutiveFailures = 0;
    this.lastLlmFailure = null;
    this.llmProviderHealthy = true;
  }

  /**
   * Check if LLM provider is currently healthy
   */
  isLlmProviderHealthy(): boolean {
    return this.llmProviderHealthy;
  }

  /**
   * Check if in degraded mode (Tier-1-only classification)
   */
  isDegradedMode(): boolean {
    return !this.llmProviderHealthy;
  }

  /**
   * Get time until LLM provider retry is attempted
   * Returns 0 if healthy or no recent failure
   */
  getTimeUntilRetry(): number {
    if (this.llmProviderHealthy || !this.lastLlmFailure) {
      return 0;
    }

    const timeSinceLast = Date.now() - this.lastLlmFailure.getTime();
    const timeUntilRetry = Math.max(
      0,
      this.DEGRADATION_COOLDOWN_MS - timeSinceLast,
    );

    return timeUntilRetry;
  }

  /**
   * Manually trigger retry of LLM provider
   * Called after cooldown period or manual intervention
   */
  retryLlmProvider(): void {
    this.logger.log('Attempting LLM provider recovery...');
    this.consecutiveFailures = 0;
    this.lastLlmFailure = null;
    this.llmProviderHealthy = true;
  }

  /**
   * Start periodic health check
   * Implements lightweight liveness probe for LLM provider
   */
  private startHealthCheck(): void {
    // Run health check every 30 seconds (configurable)
    setInterval(() => {
      if (this.isDegradedMode()) {
        this.performHealthCheck();
      }
    }, 30 * 1000);
  }

  /**
   * Perform lightweight LLM provider health check
   * In real deployment, this would call a health endpoint or cached status
   */
  private performHealthCheck(): void {
    // In production: call Anthropic status endpoint or cached health indicator
    // For now, just log that we're in degraded mode
    const timeUntilRetry = this.getTimeUntilRetry();

    if (timeUntilRetry === 0) {
      this.logger.log(
        'Cooldown expired, LLM provider retry scheduled for next classification request',
      );
    }
  }

  /**
   * Emit degradation alert to monitoring system
   * Tenant-facing status communication per ADR 0019
   */
  private emitDegradationAlert(): void {
    this.logger.warn('DEGRADATION_ALERT: LLM provider unavailable');

    // In production: emit metric/event to monitoring system
    // Example: CloudWatch, Datadog, Prometheus, etc.
    // await this.metricsService.recordDegradationEvent({
    //   service: 'llm-provider',
    //   mode: 'degraded',
    //   timestamp: new Date(),
    //   tenantScope: 'all',
    // });
  }

  /**
   * Emit recovery alert to monitoring system
   * Tenant-facing status communication per ADR 0019
   */
  private emitRecoveryAlert(): void {
    this.logger.log('RECOVERY_ALERT: LLM provider recovered');

    // In production: emit recovery metric/event
    // Example:
    // await this.metricsService.recordRecoveryEvent({
    //   service: 'llm-provider',
    //   mode: 'normal',
    //   timestamp: new Date(),
    //   tenantScope: 'all',
    // });
  }

  /**
   * Get degradation status for monitoring/debugging
   */
  getStatus(): {
    isHealthy: boolean;
    isDegraded: boolean;
    consecutiveFailures: number;
    lastFailure: Date | null;
    timeUntilRetry: number;
  } {
    return {
      isHealthy: this.llmProviderHealthy,
      isDegraded: !this.llmProviderHealthy,
      consecutiveFailures: this.consecutiveFailures,
      lastFailure: this.lastLlmFailure,
      timeUntilRetry: this.getTimeUntilRetry(),
    };
  }
}
