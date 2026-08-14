export interface SecretsVaultPort {
  // Store a secret and return an opaque handle
  store(secret: string): Promise<string>;

  // Retrieve a secret using its handle
  retrieve(handle: string): Promise<string>;

  // Delete a secret using its handle
  delete(handle: string): Promise<void>;
}
