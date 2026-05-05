#!/usr/bin/env node
// Migration runner — connects directly to Supabase PostgreSQL and runs all migrations in order
// Usage: node scripts/run-migrations.mjs <db-password>

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __dir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dir, '../supabase/migrations');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/run-migrations.mjs <db-password>');
  process.exit(1);
}

const PROJECT_REF = 'pedidyyknuwayxerzdpt';

const client = new Client({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run() {
  console.log(`\nConnecting to db.${PROJECT_REF}.supabase.co...`);

  try {
    await client.connect();
    console.log('Connected.\n');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  // Create migration tracking table if needed
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Get already-applied migrations
  const { rows: applied } = await client.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  // Read and sort migration files
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ran = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  SKIP   ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');

    try {
      console.log(`  APPLY  ${file} ...`);
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓      ${file}`);
      ran++;
    } catch (err) {
      console.error(`  ✗      ${file} FAILED: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();

  if (ran === 0) {
    console.log('\nAll migrations already applied. Schema is up to date.');
  } else {
    console.log(`\n${ran} migration(s) applied successfully.`);
  }
}

run();
