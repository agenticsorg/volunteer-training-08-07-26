import { Module } from '@nestjs/common';
import { CorrectionRecordRepository } from './infrastructure/repositories/correction-record.repository';
import { SenderReputationCacheRepository } from './infrastructure/repositories/sender-reputation-cache.repository';
import { PrismaService } from '../database/prisma.service';

@Module({
  providers: [
    PrismaService,
    CorrectionRecordRepository,
    SenderReputationCacheRepository,
  ],
  exports: [CorrectionRecordRepository, SenderReputationCacheRepository],
})
export class FeedbackLearningModule {}
