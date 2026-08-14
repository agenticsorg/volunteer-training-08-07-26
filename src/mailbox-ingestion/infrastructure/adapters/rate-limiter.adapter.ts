import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RateLimiterPort } from './mailbox-sync.port';

@Injectable()
export class RateLimiterAdapter implements RateLimiterPort, OnModuleDestroy {
  private counters = new Map<string, number>();
  private resetTimers: NodeJS.Timeout[] = [];
  
  async enforceQuota(platform: string, tenantId: string, mailboxId: string, units: number): Promise<boolean> {
    const key = `ratelimit:${platform}:${tenantId}:${mailboxId}`;
    const limits: Record<string, number> = {
      gmail: 250,
      outlook: 333,
    };
    const limit = limits[platform] || 100;
    
    const current = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, current);
    
    if (current === 1) {
      const timer = setTimeout(() => {
        this.counters.delete(key);
      }, 1000);
      this.resetTimers.push(timer);
    }
    
    return current <= limit;
  }
  
  async getCurrentUsage(platform: string, tenantId: string, mailboxId: string): Promise<number> {
    const key = `ratelimit:${platform}:${tenantId}:${mailboxId}`;
    return this.counters.get(key) || 0;
  }
  
  onModuleDestroy() {
    this.resetTimers.forEach(timer => clearTimeout(timer));
  }
}
