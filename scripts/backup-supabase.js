const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function backup() {
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
  console.log('Connected to Supabase DB. Fetching table list...');

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables to backup.`);

  const fullData = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  let totalRows = 0;
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT * FROM public."${table}"`);
      fullData.tables[table] = res.rows;
      totalRows += res.rows.length;
      if (res.rows.length > 0) {
        console.log(`  ✓ ${table}: ${res.rows.length} rows`);
      }
    } catch (tErr) {
      console.warn(`  ⚠ Could not read table ${table}: ${tErr.message}`);
    }
  }

  // Backup auth.users
  try {
    const authRes = await client.query(`
      SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at 
      FROM auth.users
    `);
    fullData.auth_users = authRes.rows;
    console.log(`  ✓ auth.users: ${authRes.rows.length} users`);
  } catch (aErr) {
    console.warn('  ⚠ auth.users error:', aErr.message);
  }

  const backupFilePath = path.join(backupDir, 'senexam_full_backup.json');
  fs.writeFileSync(backupFilePath, JSON.stringify(fullData, null, 2), 'utf8');
  const sizeKb = (fs.statSync(backupFilePath).size / 1024).toFixed(1);
  console.log(`\n🎉 Backup saved successfully to ${backupFilePath} (${sizeKb} KB, total ${totalRows} rows)!`);

  await client.end();
}

backup().catch(console.error);
