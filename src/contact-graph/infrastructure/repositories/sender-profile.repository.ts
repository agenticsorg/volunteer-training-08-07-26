import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { SenderProfile } from '../../domain/aggregates/sender-profile.aggregate';

@Injectable()
export class SenderProfileRepository {
  constructor(private prisma: PrismaService) {}

  async save(profile: SenderProfile): Promise<void> {
    await this.prisma.senderProfile.upsert({
      where: {
        tenant_id_mailbox_id_sender_address: {
          tenant_id: profile.tenantId,
          mailbox_id: profile.mailboxId,
          sender_address: profile.senderAddress,
        },
      },
      update: {
        classification: profile.classification as any,
        confidence: profile.classification.confidence,
        is_vip: profile.isVip,
        vip_auto_promoted: profile.vipAutoPromoted,
        last_interaction: new Date(),
        updated_at: new Date(),
      },
      create: {
        tenant_id: profile.tenantId,
        mailbox_id: profile.mailboxId,
        sender_address: profile.senderAddress,
        classification: profile.classification as any,
        confidence: profile.classification.confidence,
        is_vip: profile.isVip,
        vip_auto_promoted: profile.vipAutoPromoted,
        last_interaction: new Date(),
      },
    });
  }

  async loadBySender(tenantId: string, mailboxId: string, senderAddress: string): Promise<SenderProfile | null> {
    const record = await this.prisma.senderProfile.findUnique({
      where: {
        tenant_id_mailbox_id_sender_address: {
          tenant_id: tenantId,
          mailbox_id: mailboxId,
          sender_address: senderAddress,
        },
      },
    });

    if (!record) return null;

    const profile = new SenderProfile(tenantId, mailboxId, senderAddress);
    profile.isVip = record.is_vip;
    profile.vipAutoPromoted = record.vip_auto_promoted;
    // Reconstruct classification from stored JSON
    if (record.classification) {
      profile.classification = record.classification as any;
    }
    return profile;
  }

  async findByMailbox(tenantId: string, mailboxId: string): Promise<SenderProfile[]> {
    const records = await this.prisma.senderProfile.findMany({
      where: {
        tenant_id: tenantId,
        mailbox_id: mailboxId,
      },
    });

    return records.map(record => {
      const profile = new SenderProfile(tenantId, mailboxId, record.sender_address);
      profile.isVip = record.is_vip;
      profile.vipAutoPromoted = record.vip_auto_promoted;
      if (record.classification) {
        profile.classification = record.classification as any;
      }
      return profile;
    });
  }

  async deleteByTenant(tenantId: string): Promise<void> {
    await this.prisma.senderProfile.deleteMany({
      where: {
        tenant_id: tenantId,
      },
    });
  }
}
