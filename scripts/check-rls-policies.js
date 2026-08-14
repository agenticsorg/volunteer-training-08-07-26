/**
 * RLS Policy Coverage Check
 * Verifies that all tenant-scoped tables have Row-Level Security policies
 * Fails the build if any tenant-scoped table lacks an RLS policy
 *
 * Derives the tenant-scoped table set DYNAMICALLY from every `model { ... }`
 * block in schema.prisma that has a tenant_id field (honoring @@map when
 * present), and checks coverage across ALL migration.sql files, not just
 * the initial one. A hardcoded table list would silently stop catching new
 * tenant-scoped tables the moment a later stage adds one.
 */

const fs = require('fs');
const path = require('path');

// Read the Prisma schema
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf-8');

// Extract every model block, honoring @@map for the real table name
const tenantScopedTables = new Set();
const modelBlockPattern = /model\s+(\w+)\s*\{([^}]*)\}/gs;
let modelMatch;
while ((modelMatch = modelBlockPattern.exec(schema)) !== null) {
  const [, modelName, body] = modelMatch;
  if (!/\btenant_id\b/.test(body)) continue;
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  const tableName = mapMatch
    ? mapMatch[1]
    : modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  tenantScopedTables.add(tableName);
}

// Read and concatenate ALL migration SQL files, not just the first one
const migrationsDir = path.join(__dirname, '../prisma/migrations');
const migration = fs
  .readdirSync(migrationsDir)
  .filter((entry) => fs.statSync(path.join(migrationsDir, entry)).isDirectory())
  .map((dir) => {
    const file = path.join(migrationsDir, dir, 'migration.sql');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  })
  .join('\n');

// Check that each tenant-scoped table has RLS enabled
const missingRLS = [];
const missingPolicies = [];

tenantScopedTables.forEach((table) => {
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
