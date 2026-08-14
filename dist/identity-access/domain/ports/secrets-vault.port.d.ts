export interface SecretsVaultPort {
    store(secret: string): Promise<string>;
    retrieve(handle: string): Promise<string>;
    delete(handle: string): Promise<void>;
}
//# sourceMappingURL=secrets-vault.port.d.ts.map