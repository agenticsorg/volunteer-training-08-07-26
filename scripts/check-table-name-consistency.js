/**
 * Table Name Consistency Check
 * Verifies that Prisma model names (with @@map or default naming convention)
 * match the actual CREATE TABLE statements in migrations
 */

const fs = require('fs');
const path = require('path');

// Get Prisma dmmf for real table names
const { Prisma } = require('@prisma/client');

const dmmfModels = {};
for (const model of Prisma.dmmf.datamodel.models) {
  // Use dbName if present, otherwise apply Prisma's default naming convention
  const realTableName = model.dbName || 
    model.name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();
  dmmfModels[model.name] = realTableName;
}

// Read migration files
const migrationsDir = path.join(__dirname, '../prisma/migrations');
const migrationSQL = fs
  .readdirSync(migrationsDir)
  .filter(entry => fs.statSync(path.join(migrationsDir, entry)).isDirectory())
  .map(dir => {
    const file = path.join(migrationsDir, dir, 'migration.sql');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  })
  .join('\n');

// Check each model's table name appears in migrations
const mismatches = [];
const allTableNames = Object.values(dmmfModels);

for (const [modelName, expectedTableName] of Object.entries(dmmfModels)) {
  // Check if this table is created in migrations
  const createTablePattern = new RegExp(`CREATE TABLE\\s+"${expectedTableName}"`, 'i');
  if (!createTablePattern.test(migrationSQL)) {
    mismatches.push({
      model: modelName,
      expectedTable: expectedTableName,
      reason: `CREATE TABLE "${expectedTableName}" not found in migrations`,
    });
  }
}

// Report results
let hasErrors = false;

if (mismatches.length > 0) {
  console.error('❌ Table name mismatches found:');
  for (const mismatch of mismatches) {
    console.error(`  ${mismatch.model}: expected table "${mismatch.expectedTable}" - ${mismatch.reason}`);
  }
  hasErrors = true;
}

if (!hasErrors) {
  console.log('✅ All Prisma models have matching CREATE TABLE statements');
  console.log(`   Verified ${Object.keys(dmmfModels).length} models`);
  process.exit(0);
} else {
  console.error('\n❌ Table name consistency check failed');
  process.exit(1);
}
