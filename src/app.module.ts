import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { TenantSubscriptionModule } from './tenant-subscription/tenant-subscription.module';
import { IdentityAccessModule } from './identity-access/identity-access.module';
import { MailboxIngestionModule } from './mailbox-ingestion/mailbox-ingestion.module';
import { ClassificationModule } from './classification/classification.module';
import { ContactGraphModule } from './contact-graph/contact-graph.module';
import { ThreatDetectionModule } from './threat-detection/threat-detection.module';
import { PrioritizationModule } from './prioritization/prioritization.module';
import { MailboxWritebackModule } from './mailbox-writeback/mailbox-writeback.module';
import { FeedbackLearningModule } from './feedback-learning/feedback-learning.module';
import { NotificationAlertingModule } from './notification-alerting/notification-alerting.module';
import { ApiV1Module } from './api/v1/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ maxListeners: 100 }),
    HealthModule,
    TenantSubscriptionModule,
    IdentityAccessModule,
    MailboxIngestionModule,
    ClassificationModule,
    ContactGraphModule,
    ThreatDetectionModule,
    PrioritizationModule,
    MailboxWritebackModule,
    FeedbackLearningModule,
    NotificationAlertingModule,
    ApiV1Module,
  ],
})
export class AppModule {}
