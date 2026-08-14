import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MessagePriorityRepository } from './infrastructure/repositories/message-priority.repository';

@Module({
  imports: [DatabaseModule],
  providers: [MessagePriorityRepository],
  exports: [MessagePriorityRepository],
})
export class PrioritizationModule {}
