import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MessagePriority } from '../../domain/aggregates/message-priority.aggregate';

@Injectable()
export class MessagePriorityRepository {
  constructor(private prisma: PrismaService) {}

  async save(priority: MessagePriority): Promise<void> {
    // Pending MessagePriority table in Prisma schema
  }

  async findByMessageId(tenantId: string, messageId: string): Promise<MessagePriority | null> {
    return null;
  }
}
