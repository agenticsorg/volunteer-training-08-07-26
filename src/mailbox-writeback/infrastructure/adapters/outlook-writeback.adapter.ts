import { Injectable } from '@nestjs/common';
import { FacetType } from '../../domain/value-objects/facet-application';
import {
  ApplyFacetResult,
  MailboxWritePort,
} from '../../domain/ports/mailbox-write.port';
import { WriteBackFailureReason } from '../../domain/value-objects/writeback-failure-reason';

@Injectable()
export class OutlookWriteBackAdapter implements MailboxWritePort {
  getPlatformType(): 'gmail' | 'outlook' {
    return 'outlook';
  }

  async applyFacet(
    mailboxId: string,
    messageId: string,
    facetType: FacetType,
    desiredValue: any,
  ): Promise<ApplyFacetResult> {
    // Map facet types to Outlook categories and properties
    const result = this.mapFacetToOutlookUpdate(facetType, desiredValue);
    if (!result) {
      return { success: true, appliedValue: null };
    }

    // In a real implementation, this would call Microsoft Graph API
    try {
      // Simulate API call
      if (Math.random() > 0.95) {
        return {
          success: false,
          failure: WriteBackFailureReason.platformError(
            500,
            'Simulated Graph API error',
          ),
        };
      }

      return {
        success: true,
        appliedValue: result,
      };
    } catch (error: any) {
      const statusCode = error.response?.status || 500;

      if (statusCode === 429) {
        return {
          success: false,
          failure: WriteBackFailureReason.rateLimited(error.response?.headers),
        };
      }

      if (statusCode === 401 || statusCode === 403) {
        return {
          success: false,
          failure: WriteBackFailureReason.authRevoked(),
        };
      }

      if (statusCode === 404) {
        return {
          success: false,
          failure: WriteBackFailureReason.messageDeleted(),
        };
      }

      return {
        success: false,
        failure: WriteBackFailureReason.platformError(
          statusCode,
          error.message,
        ),
      };
    }
  }

  async checkMessageExists(
    mailboxId: string,
    messageId: string,
  ): Promise<boolean> {
    // In real implementation, check via Graph API
    return true;
  }

  private mapFacetToOutlookUpdate(
    facetType: FacetType,
    desiredValue: any,
  ): Record<string, any> | null {
    const update: Record<string, any> = {};

    switch (facetType) {
      case 'category':
        const categoryName = desiredValue?.category || desiredValue;
        if (categoryName) {
          update.categories = [categoryName];
        }
        break;

      case 'threat':
        if (desiredValue?.quarantine_locked || desiredValue?.quarantined) {
          update.categories = ['Quarantine'];
          update.isRead = false;
        } else if (desiredValue?.phishing) {
          update.categories = ['Phishing'];
          update.isRead = false;
        }
        break;

      case 'contact':
        if (desiredValue?.personal) {
          update.categories = ['Personal'];
        }
        break;

      case 'priority':
        const tier = desiredValue?.tier || desiredValue;
        if (tier) {
          update.categories = [this.mapTierToCategory(tier)];
          update.importance = this.mapTierToImportance(tier);
        }
        break;
    }

    return Object.keys(update).length > 0 ? update : null;
  }

  private mapTierToCategory(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'critical':
        return 'Priority-Critical';
      case 'high':
        return 'Priority-High';
      case 'normal':
        return 'Priority-Normal';
      case 'low':
        return 'Priority-Low';
      default:
        return 'Priority-Normal';
    }
  }

  private mapTierToImportance(tier: string): 'low' | 'normal' | 'high' {
    switch (tier.toLowerCase()) {
      case 'critical':
        return 'high';
      case 'high':
        return 'high';
      case 'normal':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }
}
