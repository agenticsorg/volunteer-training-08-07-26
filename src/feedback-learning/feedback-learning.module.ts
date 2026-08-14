import { Module } from '@nestjs/common';
import { CorrectionRecordRepository } from './infrastructure/repositories/correction-record.repository';
import { SenderReputationCacheRepository } from './infrastructure/repositories/sender-reputation-cache.repository';

@Module({
  providers: [CorrectionRecordRepository, SenderReputationCacheRepository],
  exports: [CorrectionRecordRepository, SenderReputationCacheRepository],
})
export class FeedbackLearningModule {}
