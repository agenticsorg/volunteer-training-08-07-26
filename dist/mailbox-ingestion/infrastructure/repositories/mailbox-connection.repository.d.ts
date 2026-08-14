export declare class MailboxConnectionRepository {
    private storage;
    findByTenantIdAndMailboxId(tenantId: string, mailboxId: string, platform: string): Promise<any>;
    updateSyncCursor(id: string, cursorValue: string): Promise<any>;
    incrementFailureCount(id: string): Promise<any>;
    save(data: any): Promise<any>;
}
//# sourceMappingURL=mailbox-connection.repository.d.ts.map