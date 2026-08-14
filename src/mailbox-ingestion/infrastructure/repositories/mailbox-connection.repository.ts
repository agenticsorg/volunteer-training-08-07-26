import { Injectable } from '@nestjs/common';

@Injectable()
export class MailboxConnectionRepository {
  private storage = new Map<string, any>();
  
  async findByTenantIdAndMailboxId(tenantId: string, mailboxId: string, platform: string) {
    const key = `${tenantId}:${mailboxId}:${platform}`;
    return this.storage.get(key);
  }
  
  async updateSyncCursor(id: string, cursorValue: string): Promise<any> {
    return { id, syncCursorValue: cursorValue, lastSyncAt: new Date() };
  }
  
  async incrementFailureCount(id: string): Promise<any> {
    return { id, syncFailureCount: 1 };
  }
  
  async save(data: any): Promise<any> {
    const key = `${data.tenantId}:${data.mailboxId}:${data.platform}`;
    this.storage.set(key, data);
    return data;
  }
}
