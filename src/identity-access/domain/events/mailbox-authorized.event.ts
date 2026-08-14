export class MailboxAuthorizedEvent {
  constructor(
    readonly tenantId: string,
    readonly userId: string,
    readonly mailboxId: string,
    readonly platform: 'gmail' | 'outlook',
    readonly scopes: string[],
    readonly timestamp: Date = new Date(),
  ) {}
}
