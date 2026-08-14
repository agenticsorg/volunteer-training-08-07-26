import { Injectable } from '@nestjs/common';
import { SecretsVaultPort } from '../../domain/ports/secrets-vault.port';

@Injectable()
export class MockSecretsVaultAdapter implements SecretsVaultPort {
  private vault = new Map<string, string>();

  async store(secret: string): Promise<string> {
    const handle = `vault_${Date.now()}_${Math.random()}`;
    this.vault.set(handle, secret);
    return handle;
  }

  async retrieve(handle: string): Promise<string> {
    const secret = this.vault.get(handle);
    if (!secret) {
      throw new Error(`Secret not found: ${handle}`);
    }
    return secret;
  }

  async delete(handle: string): Promise<void> {
    this.vault.delete(handle);
  }
}
