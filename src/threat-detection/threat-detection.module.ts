import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ThreatAssessmentRepository } from './infrastructure/repositories/threat-assessment.repository';
import { BrandWatchlistRepository } from './infrastructure/repositories/brand-watchlist.repository';
import { ThreatIntentClassifierAdapter } from './infrastructure/adapters/threat-intent-classifier.adapter';

@Module({
  imports: [DatabaseModule],
  providers: [
    ThreatAssessmentRepository,
    BrandWatchlistRepository,
    ThreatIntentClassifierAdapter,
  ],
  exports: [ThreatAssessmentRepository, BrandWatchlistRepository, ThreatIntentClassifierAdapter],
})
export class ThreatDetectionModule {}
