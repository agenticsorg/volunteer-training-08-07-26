import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SenderProfileRepository } from './infrastructure/repositories/sender-profile.repository';
import { ContactsApiAdapter } from './infrastructure/adapters/contacts-api.adapter';

@Module({
  imports: [DatabaseModule],
  providers: [
    SenderProfileRepository,
    ContactsApiAdapter,
    {
      provide: 'ContactsApiAdapter',
      useClass: ContactsApiAdapter,
    },
  ],
  exports: [
    SenderProfileRepository,
    ContactsApiAdapter,
  ],
})
export class ContactGraphModule {}
