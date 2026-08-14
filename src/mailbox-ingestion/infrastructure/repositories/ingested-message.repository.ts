import { Injectable } from '@nestjs/common';

@Injectable()
export class IngestedMessageRepository {
  private storage = new Map<string, any>();
  
  async findByPlatformMessageId(tenantId: string, platformMessageId: string, platform: string, mailboxId: string) {
    const key = `${tenantId}:${platformMessageId}:${platform}:${mailboxId}`;
    return this.storage.get(key);
  }
  
  async save(data: any): Promise<any> {
    const key = `${data.tenantId}:${data.platformMessageId}:${data.platform}:${data.mailboxId}`;
    if (this.storage.has(key)) {
      return this.storage.get(key);
    }
    this.storage.set(key, data);
    return data;
  }
  
  async findById(id: string) {
    for (const msg of this.storage.values()) {
      if (msg.id === id) return msg;
    }
    return null;
  }
}
