import { Injectable } from '@nestjs/common';
import { FacetType } from '../../domain/value-objects/facet-application';
import {
  ApplyFacetResult,
  MailboxWritePort,
} from '../../domain/ports/mailbox-write.port';
import { WriteBackFailureReason } from '../../domain/value-objects/writeback-failure-reason';

@Injectable()
export class GmailWriteBackAdapter implements MailboxWritePort {
  getPlatformType(): 'gmail' | 'outlook' {
    return 'gmail';
  }

  async applyFacet(
    mailboxId: string,
    messageId: string,
    facetType: FacetType,
    desiredValue: any,
  ): Promise<ApplyFacetResult> {
    // Map facet types to Gmail labels
    const labelMapping = this.mapFacetToGmailLabel(facetType, desiredValue);
    if (!labelMapping) {
      return { success: true, appliedValue: null };
    }

    // In a real implementation, this would call Gmail API
    // For now, return success to allow testing
    try {
      // Simulate API call
      if (Math.random() > 0.95) {
        return {
          success: false,
          failure: WriteBackFailureReason.platformError(
            500,
            'Simulated Gmail API error',
          ),
        };
      }

      return {
        success: true,
        appliedValue: labelMapping,
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
    // In real implementation, check via Gmail API
    return true;
  }

  private mapFacetToGmailLabel(
    facetType: FacetType,
    desiredValue: any,
  ): string | null {
    switch (facetType) {
      case 'category':
        // Map category names to Gmail labels
        const categoryName = desiredValue?.category || desiredValue;
        return categoryName
          ? `saas/${categoryName.toLowerCase()}`
          : null;
      case 'threat':
        if (desiredValue?.quarantine_locked || desiredValue?.quarantined) {
          return 'saas/quarantine';
        }
        if (desiredValue?.phishing) {
          return 'saas/phishing';
        }
        return null;
      case 'contact':
        if (desiredValue?.personal) {
          return 'saas/personal';
        }
        return null;
      case 'priority':
        const tier = desiredValue?.tier || desiredValue;
        return tier ? `saas/priority-${tier.toLowerCase()}` : null;
      default:
        return null;
    }
  }
}
