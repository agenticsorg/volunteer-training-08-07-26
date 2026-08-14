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
//# sourceMappingURL=rls-policy.spec.d.ts.map