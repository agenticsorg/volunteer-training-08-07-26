export declare class IngestedMessageRepository {
    private storage;
    findByPlatformMessageId(tenantId: string, platformMessageId: string, platform: string, mailboxId: string): Promise<any>;
    save(data: any): Promise<any>;
    findById(id: string): Promise<any>;
}
//# sourceMappingURL=ingested-message.repository.d.ts.map