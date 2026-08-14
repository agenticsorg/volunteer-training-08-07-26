export type FailureReasonType =
  | 'rate_limited'
  | 'auth_revoked'
  | 'message_deleted'
  | 'platform_error'
  | 'unknown';

export class WriteBackFailureReason {
  private constructor(
    public readonly type: FailureReasonType,
    public readonly message: string,
    public readonly retryable: boolean,
  ) {}

  static rateLimited(headers?: Record<string, any>): WriteBackFailureReason {
    const retryAfter = headers?.['retry-after']
      ? `retry after ${headers['retry-after']}`
      : '';
    return new WriteBackFailureReason(
      'rate_limited',
      `Rate limit exceeded ${retryAfter}`.trim(),
      true,
    );
  }

  static authRevoked(): WriteBackFailureReason {
    return new WriteBackFailureReason(
      'auth_revoked',
      'OAuth token revoked or expired',
      false,
    );
  }

  static messageDeleted(): WriteBackFailureReason {
    return new WriteBackFailureReason(
      'message_deleted',
      'Message no longer exists on platform',
      false,
    );
  }

  static platformError(
    statusCode: number,
    message: string,
  ): WriteBackFailureReason {
    const retryable = statusCode >= 500 || statusCode === 429;
    return new WriteBackFailureReason(
      'platform_error',
      `${statusCode}: ${message}`,
      retryable,
    );
  }

  static unknown(message: string): WriteBackFailureReason {
    return new WriteBackFailureReason('unknown', message, true);
  }

  toDb(): Record<string, any> {
    return {
      type: this.type,
      message: this.message,
      retryable: this.retryable,
    };
  }
}
