import { Module } from '@nestjs/common';
import { SenderProfileRepository } from './infrastructure/repositories/sender-profile.repository';

@Module({
  providers: [SenderProfileRepository],
  exports: [SenderProfileRepository],
})
export class ContactGraphModule {}
