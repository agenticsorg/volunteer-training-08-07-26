import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { TenantSubscriptionModule } from './tenant-subscription/tenant-subscription.module';
import { IdentityAccessModule } from './identity-access/identity-access.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HealthModule,
    ObservabilityModule,
    QueueModule,
    TenantSubscriptionModule,
    IdentityAccessModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
