import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ThreatAssessmentRepository } from './infrastructure/repositories/threat-assessment.repository';
import { BrandWatchlistRepository } from './infrastructure/repositories/brand-watchlist.repository';
import { ThreatIntentClassifierAdapter } from './infrastructure/adapters/threat-intent-classifier.adapter';
import { AnthropicClassifierAdapter } from '../classification/infrastructure/adapters/anthropic-classifier.adapter';

@Module({
  imports: [DatabaseModule],
  providers: [
    ThreatAssessmentRepository,
    BrandWatchlistRepository,
    {
      provide: 'CLASSIFIER_PORT',
      useClass: AnthropicClassifierAdapter,
    },
    ThreatIntentClassifierAdapter,
  ],
  exports: [ThreatAssessmentRepository, BrandWatchlistRepository, ThreatIntentClassifierAdapter],
})
export class ThreatDetectionModule {}
