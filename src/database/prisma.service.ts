import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      logger.info('Prisma connected to database');
    } catch (error) {
      logger.error(error, 'Failed to connect to database');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Set tenant context for RLS. Session-scoped (not transaction-local) — for a
  // write that must be atomic with an RLS-scoped write, use
  // `runInTenantTransaction` (src/database/tenant-transaction.ts) instead,
  // which scopes the setting to one transaction rather than the pooled
  // connection's session.
  async setTenantContext(tenantId: string) {
    await this.$executeRawUnsafe(
      `SELECT set_config('row_security_context.tenant_id', $1, false)`,
      tenantId,
    );
  }
}
