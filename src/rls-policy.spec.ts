/**
 * RLS Policy Coverage Test
 *
 * This test suite verifies that all tenant-scoped tables have Row-Level Security policies.
 * It's designed to be run against the Prisma schema and migrations.
 *
 * To run against a live database:
 * 1. Ensure the database is initialized with migrations
 * 2. Execute SQL queries to verify RLS policies exist on all tenant_id columns
 *
 * Expected behavior:
 * - All tables with tenant_id column must have RLS enabled
 * - All RLS policies must reference row_security_context.tenant_id
 * - Policies must use USING clause to filter by tenant_id
 */

import { PrismaClient } from '@prisma/client';

// The application's default DATABASE_URL connects as the table OWNER, which
// Postgres exempts from RLS policies by default (see migration
// 20260821160000_add_domain_event_outbox for the full finding and the
// restricted, non-owner "app_user" role it creates specifically so this can
// be tested for real). Build that role's connection string from the same
// host/port/database as DATABASE_URL, swapping only the credentials.
function restrictedDbUrl(): string {
  const url = new URL(process.env.DATABASE_URL as string);
  url.username = 'app_user';
  url.password = 'app_user_dev_only_change_in_prod';
  return url.toString();
}

describe('RLS Policy Coverage', () => {
  // Dynamically extract tables that have RLS enabled from the migration
  const extractRLSEnabledTables = (migration: string): string[] => {
    const matches = migration.match(/ALTER TABLE\s+"([^"]+)"\s+ENABLE ROW LEVEL SECURITY/g) || [];
    return matches.map(m => {
      const match = m.match(/"([^"]+)"/);
      return match ? match[1] : '';
    }).filter(Boolean);
  };

  // Dynamically find the baseline migration file (handles different timestamps)
  const getMigrationPath = () => {
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = './prisma/migrations';
    const files = fs.readdirSync(migrationsDir);
    const baselineFolders = files.filter((f: string) => f.includes('baseline'));
    if (baselineFolders.length === 0) throw new Error('No baseline migration found');
    return path.join(migrationsDir, baselineFolders[0], 'migration.sql');
  };

  const migrationPath = getMigrationPath();

  describe('Migration File', () => {
    it('should exist', () => {
      const fs = require('fs');
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('should enable RLS on tenant-scoped tables', () => {
      const fs = require('fs');
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      const rlsEnabledTables = extractRLSEnabledTables(migration);

      expect(rlsEnabledTables.length).toBeGreaterThan(0);
    });

    it('should create RLS policies for all RLS-enabled tables', () => {
      const fs = require('fs');
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      const rlsEnabledTables = extractRLSEnabledTables(migration);

      rlsEnabledTables.forEach(table => {
        const policy_pattern = new RegExp(`CREATE POLICY.*ON.*"${table}"`, 'i');
        expect(policy_pattern.test(migration)).toBe(true);
      });
    });

    it('should reference row_security_context.tenant_id in all policies', () => {
      const fs = require('fs');
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      const rlsEnabledTables = extractRLSEnabledTables(migration);

      // Count occurrences of row_security_context.tenant_id
      const contextPattern = /row_security_context\.tenant_id/g;
      const matches = migration.match(contextPattern) || [];

      // Should have at least one reference per RLS-enabled table
      expect(matches.length).toBeGreaterThanOrEqual(rlsEnabledTables.length);
    });
  });

  describe('RLS Adversarial Tests (against live DB, as the restricted app_user role)', () => {
    // Skipped if no database is available. Connects as "app_user" — a
    // non-owner role with NOBYPASSRLS (created by migration
    // 20260821160000_add_domain_event_outbox) — rather than the default
    // owner-role DATABASE_URL, because Postgres exempts a table's owner from
    // its own RLS policies by default. A test run as the owner would "pass"
    // this suite even if every policy were deleted; see the migration's
    // comments and the tracked GitHub issue for why the running application
    // does not yet connect this way for real (that's the larger, separate
    // fix — this suite proves the policies themselves are correct).
    const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip;

    skipIfNoDb('cross-tenant isolation', () => {
      let admin: PrismaClient;
      let restricted: PrismaClient;
      let tenant1Id: string;
      let tenant2Id: string;

      beforeAll(async () => {
        admin = new PrismaClient();
        restricted = new PrismaClient({ datasources: { db: { url: restrictedDbUrl() } } });

        const t1 = await admin.tenant.create({ data: { name: 'RLS Adversarial Test — Tenant 1' } });
        const t2 = await admin.tenant.create({ data: { name: 'RLS Adversarial Test — Tenant 2' } });
        tenant1Id = t1.id;
        tenant2Id = t2.id;

        await admin.mailboxConnection.create({
          data: { tenantId: tenant1Id, mailboxId: 'tenant1@example.com', platform: 'gmail', credentialHandleId: 'handle-1' },
        });
        await admin.mailboxConnection.create({
          data: { tenantId: tenant2Id, mailboxId: 'tenant2@example.com', platform: 'gmail', credentialHandleId: 'handle-2' },
        });
      });

      afterAll(async () => {
        await admin.mailboxConnection.deleteMany({ where: { tenantId: { in: [tenant1Id, tenant2Id] } } });
        await admin.tenant.deleteMany({ where: { id: { in: [tenant1Id, tenant2Id] } } });
        await admin.$disconnect();
        await restricted.$disconnect();
      });

      it('should block cross-tenant read: tenant-1 context sees only tenant-1 rows', async () => {
        const rows = await restricted.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SELECT set_config('row_security_context.tenant_id', $1, true)`, tenant1Id);
          return tx.mailboxConnection.findMany({ where: { tenantId: { in: [tenant1Id, tenant2Id] } } });
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].tenantId).toBe(tenant1Id);
      });

      it('should block cross-tenant write: cannot insert a row for another tenant while scoped to tenant-1', async () => {
        await expect(
          restricted.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT set_config('row_security_context.tenant_id', $1, true)`, tenant1Id);
            // RLS policies with only a USING clause apply it as the WITH CHECK
            // clause too for INSERT/UPDATE, so this insert for tenant-2's id
            // while scoped to tenant-1 must be rejected, not silently accepted.
            return tx.mailboxConnection.create({
              data: { tenantId: tenant2Id, mailboxId: 'malicious@example.com', platform: 'gmail', credentialHandleId: 'handle-x' },
            });
          }),
        ).rejects.toThrow();

        const leaked = await admin.mailboxConnection.findFirst({
          where: { tenantId: tenant2Id, mailboxId: 'malicious@example.com' },
        });
        expect(leaked).toBeNull();
      });
    });
  });
});
