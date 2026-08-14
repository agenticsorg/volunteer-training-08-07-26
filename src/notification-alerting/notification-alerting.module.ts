import { Module } from '@nestjs/common';
import { NotificationSubscriptionRepository } from './infrastructure/repositories/notification-subscription.repository';
import { AlertDispatchRepository } from './infrastructure/repositories/alert-dispatch.repository';

@Module({
  providers: [NotificationSubscriptionRepository, AlertDispatchRepository],
  exports: [NotificationSubscriptionRepository, AlertDispatchRepository],
})
export class NotificationAlertingModule {}
