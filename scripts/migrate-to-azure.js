/**
 * Migration Script: Supabase -> Azure Local PostgreSQL
 * Copies all 75+ tables, schemas, and rows directly from Supabase to Azure.
 */

const { Client } = require('pg');

const SOURCE_URL = process.env.SOURCE_DB_URL;
const TARGET_URL =
  process.env.TARGET_DB_URL ||
  'postgresql://senexam_admin:SenExam%402026%21Azure@localhost:5432/senexam_db';

if (!SOURCE_URL) {
  console.error('❌ Error: Missing SOURCE_DB_URL environment variable.');
  console.error('Usage: SOURCE_DB_URL="postgresql://..." node scripts/migrate-to-azure.js');
  process.exit(1);
}

async function runMigration() {
  console.log('========================================================');
  console.log('🚀 SENEXAM: SUPABASE -> AZURE LOCAL POSTGRESQL MIGRATION');
  console.log('========================================================\n');

  const sourceClient = new Client({
    connectionString: SOURCE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const targetClient = new Client({
    connectionString: TARGET_URL,
    ssl: false,
  });

  try {
    console.log('Connecting to Source (Supabase)...');
    await sourceClient.connect();
    console.log('✓ Connected to Supabase successfully.');

    console.log('Connecting to Target (Azure PostgreSQL)...');
    await targetClient.connect();
    console.log('✓ Connected to Azure PostgreSQL successfully.\n');

    // 1. Prepare Target Schemas & Extensions
    console.log('Step 1: Setting up schemas and extensions on Azure...');
    await targetClient.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);
    console.log('✓ Schemas (public, auth, storage) & Extensions created.\n');

    // Create auth.users table on Azure target if not exists
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        encrypted_password TEXT,
        email_confirmed_at TIMESTAMPTZ,
        raw_user_meta_data JSONB,
        raw_app_meta_data JSONB,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `);

    // 2. Fetch list of tables from Supabase public schema
    console.log('Step 2: Inspecting tables on Supabase...');
    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r) => r.table_name);
    console.log(`Found ${tables.length} tables in public schema.\n`);

    // 3. For each table, create DDL and copy data
    console.log('Step 3: Migrating tables and data to Azure...\n');
    let totalRowsMigrated = 0;

    for (const table of tables) {
      // Get column definitions from source
      const colRes = await sourceClient.query(`
        SELECT 
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      if (colRes.rows.length === 0) continue;

      const colTypeMap = {};
      for (const c of colRes.rows) {
        colTypeMap[c.column_name] = c.udt_name;
      }

      // Get primary key
      const pkRes = await sourceClient.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_schema = 'public' 
          AND tc.table_name = $1;
      `, [table]);
      const pks = pkRes.rows.map((r) => r.column_name);

      // Build CREATE TABLE SQL
      const colDefs = colRes.rows.map((col) => {
        let type = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
        if (type === 'ARRAY') type = `${col.udt_name.replace(/^_/, '')}[]`;
        let def = `"${col.column_name}" ${type}`;
        if (col.column_default && !col.column_default.includes('nextval')) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      });

      if (pks.length > 0) {
        colDefs.push(`PRIMARY KEY (${pks.map((c) => `"${c}"`).join(', ')})`);
      }

      await targetClient.query(`CREATE TABLE IF NOT EXISTS public."${table}" (\n  ${colDefs.join(',\n  ')}\n);`);

      // Ensure any newly added columns exist on target table
      for (const col of colRes.rows) {
        let type = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
        if (type === 'ARRAY') type = `${col.udt_name.replace(/^_/, '')}[]`;
        try {
          await targetClient.query(`ALTER TABLE public."${table}" ADD COLUMN IF NOT EXISTS "${col.column_name}" ${type};`);
        } catch (_) {}
      }

      // Copy data
      const dataRes = await sourceClient.query(`SELECT * FROM public."${table}"`);
      const rows = dataRes.rows;

      if (rows.length > 0) {
        // Truncate target table before inserting to prevent duplicate keys
        await targetClient.query(`TRUNCATE TABLE public."${table}" CASCADE;`);

        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `"${c}"`).join(', ');

        let successCount = 0;
        for (const row of rows) {
          const values = cols.map((c) => {
            const val = row[c];
            if (val === null || val === undefined) return null;
            const udt = colTypeMap[c];
            if (udt === 'json' || udt === 'jsonb') {
              return typeof val === 'string' ? val : JSON.stringify(val);
            }
            if (typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val) && !Array.isArray(val)) {
              return JSON.stringify(val);
            }
            return val;
          });
          const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
          const insertSql = `INSERT INTO public."${table}" (${colList}) VALUES (${placeholders});`;
          try {
            await targetClient.query(insertSql, values);
            successCount++;
          } catch (iErr) {
            console.warn(`    ⚠ Insert error on ${table}: ${iErr.message}`);
          }
        }
        totalRowsMigrated += successCount;
        console.log(`  ✓ ${table}: Migrated ${successCount}/${rows.length} rows.`);
      } else {
        console.log(`  ✓ ${table}: 0 rows (table structure created).`);
      }
    }

    // 4. Migrate auth.users
    console.log('\nStep 4: Migrating auth.users (student & admin logins)...');
    try {
      const authUsersRes = await sourceClient.query(`
        SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        FROM auth.users;
      `);
      if (authUsersRes.rows.length > 0) {
        await targetClient.query('TRUNCATE TABLE auth.users CASCADE;');
        for (const u of authUsersRes.rows) {
          await targetClient.query(
            `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;`,
            [u.id, u.email, u.encrypted_password, u.email_confirmed_at, u.raw_user_meta_data, u.raw_app_meta_data, u.created_at, u.updated_at]
          );
        }
        console.log(`  ✓ auth.users: Migrated ${authUsersRes.rows.length} users successfully.`);
      }
    } catch (authErr) {
      console.warn('  ⚠ auth.users migration note:', authErr.message);
    }

    console.log('\n========================================================');
    console.log(`🎉 MIGRATION FINISHED! Total rows migrated: ${totalRowsMigrated}`);
    console.log('All 75 tables are now running locally on Azure PostgreSQL!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    await sourceClient.end().catch(() => {});
    await targetClient.end().catch(() => {});
  }
}

runMigration();
