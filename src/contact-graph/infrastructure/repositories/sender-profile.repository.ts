import { Injectable } from '@nestjs/common';
import { SenderProfile } from '../../domain/aggregates/sender-profile.aggregate';

@Injectable()
export class SenderProfileRepository {
  private store = new Map<string, SenderProfile>();

  private makeKey(tenantId: string, mailboxId: string, senderAddress: string): string {
    return `${tenantId}:${mailboxId}:${senderAddress}`;
  }

  async save(profile: SenderProfile): Promise<void> {
    const key = this.makeKey(profile.tenantId, profile.mailboxId, profile.senderAddress);
    this.store.set(key, profile);
  }

  async loadBySender(tenantId: string, mailboxId: string, senderAddress: string): Promise<SenderProfile | null> {
    const key = this.makeKey(tenantId, mailboxId, senderAddress);
    return this.store.get(key) || null;
  }

  async findByMailbox(tenantId: string, mailboxId: string): Promise<SenderProfile[]> {
    const prefix = `${tenantId}:${mailboxId}:`;
    const results: SenderProfile[] = [];

    for (const [key, profile] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        results.push(profile);
      }
    }

    return results;
  }

  async deleteByTenant(tenantId: string): Promise<void> {
    const prefix = `${tenantId}:`;
    const keysToDelete: string[] = [];

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }
}
