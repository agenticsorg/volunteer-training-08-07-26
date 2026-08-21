import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Prisma's `$transaction` callback receives a client scoped to a single
 * connection. `set_config(..., true)` (the third argument) makes the setting
 * transaction-local rather than session-local, so it can never leak onto a
 * pooled connection reused by a later, differently-tenanted request — unlike
 * `PrismaService.setTenantContext()`, which sets `row_security_context.tenant_id`
 * at session scope. Any write that must be atomic with a tenant-scoped RLS
 * write (an aggregate row plus its outbox row, most commonly) should go
 * through this helper rather than issuing separate calls against the shared
 * `PrismaService` client.
 */
export async function runInTenantTransaction<T>(
  prisma: PrismaService,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('row_security_context.tenant_id', $1, true)`,
      tenantId,
    );
    return fn(tx);
  });
}
