export type Reinforcement = 'towardPersonal' | 'towardAutomated' | 'vipRevoked';

export class ContactSignalReinforced {
  constructor(
    public readonly tenantId: string,
    public readonly mailboxId: string,
    public readonly senderAddress: string,
    public readonly reinforcement: Reinforcement,
    public readonly reason: string,
  ) {}
}
