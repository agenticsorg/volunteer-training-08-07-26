import { Injectable } from '@nestjs/common';
import { SenderProfile } from '../../domain/sender-profile.aggregate';

@Injectable()
export class SenderProfileRepository {
  async findByTenantMailboxAndSender(tenant_id: string, mailbox_id: string, sender_address: string): Promise<SenderProfile | null> {
    // Implementation will use Prisma
    return null;
  }

  async save(profile: SenderProfile): Promise<void> {
    // Implementation will upsert to Prisma
  }
}
