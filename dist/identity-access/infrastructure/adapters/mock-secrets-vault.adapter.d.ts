import { SecretsVaultPort } from '../../domain/ports/secrets-vault.port';
export declare class MockSecretsVaultAdapter implements SecretsVaultPort {
    private vault;
    store(secret: string): Promise<string>;
    retrieve(handle: string): Promise<string>;
    delete(handle: string): Promise<void>;
}
//# sourceMappingURL=mock-secrets-vault.adapter.d.ts.map