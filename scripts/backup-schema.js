const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function backupSchema() {
  const connectionString = process.env.SOURCE_DB_URL;
  if (!connectionString) {
    console.error('Missing SOURCE_DB_URL');
    process.exit(1);
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Get table definitions
  const columnsRes = await client.query(`
    SELECT 
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const tables = {};
  for (const row of columnsRes.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(row);
  }

  // Get primary keys
  const pkRes = await client.query(`
    SELECT
      tc.table_name, 
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
  `);
  const primaryKeys = {};
  for (const row of pkRes.rows) {
    if (!primaryKeys[row.table_name]) primaryKeys[row.table_name] = [];
    primaryKeys[row.table_name].push(row.column_name);
  }

  let sql = `-- =========================================================\n`;
  sql += `-- SENEXAM FULL SCHEMA BACKUP\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- =========================================================\n\n`;
  sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`;
  sql += `CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`;

  for (const [table, cols] of Object.entries(tables)) {
    sql += `CREATE TABLE IF NOT EXISTS public."${table}" (\n`;
    const colDefs = cols.map(col => {
      let type = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
      if (type === 'ARRAY') type = `${col.udt_name.replace(/^_/, '')}[]`;
      let def = `  "${col.column_name}" ${type}`;
      if (col.column_default) def += ` DEFAULT ${col.column_default}`;
      if (col.is_nullable === 'NO') def += ` NOT NULL`;
      return def;
    });

    if (primaryKeys[table] && primaryKeys[table].length > 0) {
      colDefs.push(`  PRIMARY KEY (${primaryKeys[table].map(c => `"${c}"`).join(', ')})`);
    }

    sql += colDefs.join(',\n') + `\n);\n\n`;
  }

  const schemaPath = path.join(backupDir, 'senexam_schema.sql');
  fs.writeFileSync(schemaPath, sql, 'utf8');
  console.log(`✓ Schema saved successfully to ${schemaPath} (${Object.keys(tables).length} tables)!`);

  await client.end();
}

backupSchema().catch(console.error);
