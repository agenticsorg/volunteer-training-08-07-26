import { Expose } from 'class-transformer';

export class MailboxConnectionResponseDto {
  @Expose()
  id!: string;

  @Expose()
  mailbox_id!: string;

  @Expose()
  platform!: string;

  @Expose()
  status!: string;

  @Expose()
  watch_expires_at?: string;

  @Expose()
  last_webhook_at?: string;

  @Expose()
  last_sync_at?: string;

  @Expose()
  sync_failure_count!: number;

  @Expose()
  created_at!: string;

  @Expose()
  updated_at!: string;
}

export class ConnectMailboxRequestDto {
  @Expose()
  platform!: string;

  @Expose()
  auth_code!: string;
}

export class DisconnectMailboxRequestDto {
  @Expose()
  mailbox_id!: string;
}

export class MailboxConnectionsListResponseDto {
  @Expose()
  connections!: MailboxConnectionResponseDto[];

  @Expose()
  total!: number;
}
