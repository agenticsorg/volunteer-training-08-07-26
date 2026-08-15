import { Module } from '@nestjs/common';
import { ClassificationService } from './application/classification.service';
import { AnthropicClassifierAdapter } from './infrastructure/adapters/anthropic-classifier.adapter';
import { MessageClassificationRepository } from './infrastructure/repositories/message-classification.repository';
import { PrismaService } from '../database/prisma.service';
import { GracefulDegradationService } from './services/graceful-degradation.service';
import { CanaryRolloutService } from './services/canary-rollout.service';

@Module({
  imports: [],
  providers: [
    ClassificationService,
    AnthropicClassifierAdapter,
    MessageClassificationRepository,
    PrismaService,
    GracefulDegradationService,
    CanaryRolloutService,
  ],
  exports: [
    ClassificationService,
    GracefulDegradationService,
    CanaryRolloutService,
  ],
})
export class ClassificationModule {}
