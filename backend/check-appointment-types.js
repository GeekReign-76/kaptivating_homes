require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

async function main() {
  const { data, error } = await db
    .from('appointment_types')
    .select('id, name, is_active, duration_minutes, buffer_minutes, display_order')
    .order('display_order');

  if (error) { console.error('Error:', error.message); process.exit(1); }

  console.log(`Found ${data.length} appointment type(s):\n`);
  data.forEach(t => {
    console.log(`${t.is_active ? '🟢' : '🔴'} ${t.name}`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Duration: ${t.duration_minutes} min | Buffer: ${t.buffer_minutes} min`);
    console.log(`   Active: ${t.is_active}`);
    console.log('');
  });
}

main();
