import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MessageClassification, LabelAssignment } from '../aggregates/message-classification';
import { Category } from '@prisma/client';

@Injectable()
export class MessageClassificationRepository {
  constructor(private prisma: PrismaService) {}

  async findByMessageId(tenantId: string, messageId: string): Promise<MessageClassification | null> {
    const labels = await this.prisma.messageLabel.findMany({
      where: { tenant_id: tenantId, message_id: messageId },
    });

    if (!labels.length) return null;

    const classification = new MessageClassification(tenantId, messageId);
    classification.labels = labels.map(l => ({
      category: l.category as Category,
      confidence: Number(l.confidence_score),
      sourceTier: l.source_tier as any,
      classifierVersion: l.classifier_version,
    }));
    classification.isFinalized = true;
    return classification;
  }

  async save(tenantId: string, classification: MessageClassification): Promise<void> {
    // Upsert labels atomically
    for (const label of classification.labels) {
      await this.prisma.messageLabel.upsert({
        where: {
          message_id_category: {
            message_id: classification.messageId,
            category: label.category,
          },
        },
        update: {
          confidence_score: label.confidence,
          source_tier: label.sourceTier,
          classifier_version: label.classifierVersion,
        },
        create: {
          tenant_id: tenantId,
          message_id: classification.messageId,
          category: label.category,
          confidence_score: label.confidence,
          source_tier: label.sourceTier,
          classifier_version: label.classifierVersion,
        },
      });
    }
  }
}
