/**
 * RLS Policy Coverage Check
 * Verifies that all tenant-scoped tables have Row-Level Security policies
 * Fails the build if any tenant-scoped table lacks an RLS policy
 */

const fs = require('fs');
const path = require('path');

// Tables that MUST have RLS policies
const tenantScopedTables = new Set([
  'users',
  'message_queue',
  'metrics',
]);

// Read the migration SQL file
const migrationPath = path.join(__dirname, '../prisma/migrations/0_init/migration.sql');
const migration = fs.readFileSync(migrationPath, 'utf-8');

// Read the Prisma schema
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf-8');

// Extract all models with tenant_id from Prisma schema
const tenantModels = new Set();
const modelPattern = /model\s+(\w+)\s*\{[^}]*tenant_id[^}]*\}/gs;
let match;
while ((match = modelPattern.exec(schema)) !== null) {
  tenantModels.add(match[1].toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''));
}

// Check that each tenant-scoped table has RLS enabled
const missingRLS = [];
const missingPolicies = [];

tenantScopedTables.forEach(table => {
  // Check if RLS is enabled
  const rls_pattern = new RegExp(`ALTER TABLE.*"${table}".*ENABLE ROW LEVEL SECURITY`, 'i');
  if (!rls_pattern.test(migration)) {
    missingRLS.push(table);
  }

  // Check if a policy exists
  const policy_pattern = new RegExp(`CREATE POLICY.*ON.*"${table}"`, 'i');
  if (!policy_pattern.test(migration)) {
    missingPolicies.push(table);
  }
});

// Report results
let hasErrors = false;

if (missingRLS.length > 0) {
  console.error(`❌ RLS not enabled on tables: ${missingRLS.join(', ')}`);
  hasErrors = true;
}

if (missingPolicies.length > 0) {
  console.error(`❌ RLS policies missing on tables: ${missingPolicies.join(', ')}`);
  hasErrors = true;
}

if (!hasErrors) {
  console.log('✅ All tenant-scoped tables have RLS policies');
  process.exit(0);
} else {
  console.error('\n❌ RLS policy coverage check failed');
  process.exit(1);
}
