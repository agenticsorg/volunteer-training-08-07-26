import { Expose } from 'class-transformer';

export class MessageLabelDto {
  @Expose()
  category!: string;

  @Expose()
  confidence_score!: number;

  @Expose()
  source_tier!: string;
}

export class ScoreComponentDto {
  @Expose()
  name!: string;

  @Expose()
  value!: number;

  @Expose()
  weight!: number;

  @Expose()
  contribution!: number;
}

export class MessageResponseDto {
  @Expose()
  id!: string;

  @Expose()
  message_id!: string;

  @Expose()
  mailbox_id!: string;

  @Expose()
  platform!: string;

  @Expose()
  from!: string;

  @Expose()
  subject!: string;

  @Expose()
  thread_id?: string;

  @Expose()
  received_at!: string;

  @Expose()
  labels!: MessageLabelDto[];

  @Expose()
  priority_score!: number;

  @Expose()
  priority_components!: ScoreComponentDto[];

  @Expose()
  phishing_status!: string;

  @Expose()
  quarantine_decision!: string;

  @Expose()
  needs_reply?: boolean;

  @Expose()
  created_at!: string;
}

export class MessagesListResponseDto {
  @Expose()
  messages!: MessageResponseDto[];

  @Expose()
  total!: number;

  @Expose()
  limit!: number;

  @Expose()
  offset!: number;
}

export class CorrectionSubmitDto {
  @Expose()
  message_id!: string;

  @Expose()
  context!: string;

  @Expose()
  original_verdict!: string;

  @Expose()
  corrected_verdict!: string;

  @Expose()
  reason?: string;
}
