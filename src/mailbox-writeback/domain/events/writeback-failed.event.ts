import { FacetType } from '../value-objects/facet-application';
import { WriteBackFailureReason } from '../value-objects/writeback-failure-reason';

export class WriteBackFailed {
  constructor(
    public readonly tenantId: string,
    public readonly mailboxId: string,
    public readonly messageId: string,
    public readonly facetType: FacetType,
    public readonly reason: WriteBackFailureReason,
    public readonly retryCount: number,
  ) {}
}
