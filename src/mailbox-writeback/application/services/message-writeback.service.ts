import { Injectable } from '@nestjs/common';
import { MessageWriteBackState } from '../../domain/aggregates/message-writeback-state.aggregate';
import { FacetType } from '../../domain/value-objects/facet-application';
import { MessageWriteBackStateRepository } from '../../infrastructure/repositories/message-writeback-state.repository';
import { MailboxWritePort } from '../../domain/ports/mailbox-write.port';

@Injectable()
export class MessageWriteBackService {
  constructor(
    private readonly repository: MessageWriteBackStateRepository,
    private readonly gmailAdapter: MailboxWritePort,
    private readonly outlookAdapter: MailboxWritePort,
  ) {}

  async applyFacet(
    tenantId: string,
    mailboxId: string,
    messageId: string,
    facetType: FacetType,
    desiredValue: any,
    platform: 'gmail' | 'outlook',
  ): Promise<void> {
    const aggregate = await this.repository.findOrCreateByMessageId(
      tenantId,
      mailboxId,
      messageId,
    );

    const adapter = platform === 'gmail' ? this.gmailAdapter : this.outlookAdapter;
    const result = await adapter.applyFacet(
      mailboxId,
      messageId,
      facetType,
      desiredValue,
    );

    if (result.success) {
      aggregate.applyFacet(facetType, desiredValue, platform, new Date());
    } else {
      aggregate.recordFacetFailure(facetType, result.failure!, new Date());
    }

    await this.repository.save(aggregate, tenantId);
  }

  async getWriteBackState(
    tenantId: string,
    mailboxId: string,
    messageId: string,
  ): Promise<MessageWriteBackState | null> {
    return this.repository.findByMessageId(tenantId, mailboxId, messageId);
  }
}
