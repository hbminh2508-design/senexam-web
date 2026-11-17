const { Client } = require('pg');

async function sync() {
  const connectionString = process.env.DATABASE_URL || process.env.SOURCE_DB_URL;
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or SOURCE_DB_URL environment variable.');
    process.exit(1);
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const updateRes = await client.query(`
    UPDATE public.profiles p 
    SET email = u.email 
    FROM auth.users u 
    WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
  `);
  console.log('✓ Successfully synced emails from auth.users to public.profiles. Count:', updateRes.rowCount);

  const check = await client.query(`SELECT id, full_name, email FROM public.profiles WHERE email = 'hoangbinhminh2508@gmail.com';`);
  console.log('Found profile for hoangbinhminh2508@gmail.com:', check.rows);

  await client.end();
}

sync().catch(console.error);
