import { Module } from '@nestjs/common';
import { ClassificationService } from './application/classification.service';
import { AnthropicClassifierAdapter } from './infrastructure/adapters/anthropic-classifier.adapter';
import { MessageClassificationRepository } from './infrastructure/repositories/message-classification.repository';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [],
  providers: [
    ClassificationService,
    AnthropicClassifierAdapter,
    MessageClassificationRepository,
    PrismaService,
  ],
  exports: [ClassificationService],
})
export class ClassificationModule {}
