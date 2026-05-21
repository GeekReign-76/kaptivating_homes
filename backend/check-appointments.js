require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

async function main() {
  // First fetch one raw row to see actual column names
  const { data: sample, error: sampleErr } = await db
    .from('appointments')
    .select('*')
    .limit(1);

  if (sampleErr) {
    console.error('Error:', sampleErr.message);
    process.exit(1);
  }

  if (!sample || sample.length === 0) {
    console.log('No appointments found in the database.');
    return;
  }

  console.log('Columns available:', Object.keys(sample[0]).join(', '));
  console.log('\nRaw first row:\n', JSON.stringify(sample[0], null, 2));

  // Now fetch all with safe columns
  const { data, error } = await db
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`\nFound ${data.length} appointment(s) total.`);
}

main();
