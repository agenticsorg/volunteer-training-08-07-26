import { FacetType } from '../value-objects/facet-application';
import { WriteBackFailureReason } from '../value-objects/writeback-failure-reason';

export interface ApplyFacetResult {
  success: boolean;
  appliedValue?: any;
  failure?: WriteBackFailureReason;
}

export interface MailboxWritePort {
  applyFacet(
    mailboxId: string,
    messageId: string,
    facetType: FacetType,
    desiredValue: any,
  ): Promise<ApplyFacetResult>;

  checkMessageExists(mailboxId: string, messageId: string): Promise<boolean>;

  getPlatformType(): 'gmail' | 'outlook';
}
