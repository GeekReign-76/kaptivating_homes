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
    .from('appointments')
    .select(`
      id,
      status,
      appointment_type,
      requested_start,
      confirmed_start,
      notes,
      created_at,
      client:users!appointments_client_id_fkey ( id, full_name, email, phone )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No appointments found in the database.');
    return;
  }

  console.log(`Found ${data.length} appointment(s):\n`);
  data.forEach((a, i) => {
    console.log(`--- #${i + 1} ---`);
    console.log(`ID:         ${a.id}`);
    console.log(`Status:     ${a.status}`);
    console.log(`Type:       ${a.appointment_type}`);
    console.log(`Requested:  ${a.requested_start}`);
    console.log(`Confirmed:  ${a.confirmed_start ?? 'Not yet confirmed'}`);
    console.log(`Client:     ${a.client?.full_name ?? 'Unknown'} <${a.client?.email ?? 'no email'}>`);
    console.log(`Phone:      ${a.client?.phone ?? 'none'}`);
    console.log(`Notes:      ${a.notes ?? 'none'}`);
    console.log(`Created:    ${a.created_at}`);
    console.log('');
  });
}

main();
