import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { logger } from '../observability/logger';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: any;

  async onModuleInit() {
    try {
      // Lazy load PrismaClient only when needed
      if (!this.prisma) {
        const PrismaModule = await import('@prisma/client');
        const PrismaClient = (PrismaModule as any).PrismaClient;
        this.prisma = new PrismaClient({
          log: ['warn', 'error'],
        });
        await this.prisma.$connect();
      }
      logger.info('Prisma connected to database');
    } catch (error) {
      logger.error(error, 'Failed to connect to database');
    }
  }

  async onModuleDestroy() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  // Set tenant context for RLS
  async setTenantContext(tenantId: string) {
    if (this.prisma) {
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('row_security_context.tenant_id', $1, false)`,
        [tenantId],
      );
    }
  }

  // Get raw Prisma client for use in repos
  getClient(): any {
    return this.prisma;
  }
}
