import { Module } from '@nestjs/common';
import { MessagesController } from './controllers/messages.controller';
import { CorrectionsController } from './controllers/corrections.controller';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  controllers: [MessagesController, CorrectionsController],
  providers: [TenantGuard],
  exports: [TenantGuard],
})
export class ApiV1Module {}
