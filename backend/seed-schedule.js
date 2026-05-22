require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

async function main() {
  // ── Availability Windows: 8am–8pm every day ──────────────────────────────
  console.log('Seeding availability windows...');

  // Clear existing windows first
  await db.from('availability_windows').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const windows = [0, 1, 2, 3, 4, 5, 6].map(day => ({
    day_of_week: day,
    start_time:  '08:00:00',
    end_time:    '20:00:00',
    is_active:   true,
  }));

  const { error: winErr } = await db.from('availability_windows').insert(windows);
  if (winErr) { console.error('Error seeding windows:', winErr.message); process.exit(1); }
  console.log('✓ Availability windows set: 8:00 AM – 8:00 PM, all 7 days');

  // ── Appointment Types ─────────────────────────────────────────────────────
  console.log('\nChecking appointment types...');

  const { data: existing } = await db.from('appointment_types').select('id');

  if (existing && existing.length > 0) {
    console.log(`✓ ${existing.length} appointment type(s) already exist — skipping seed`);
  } else {
    const types = [
      {
        name:             'Buyer Consultation',
        description:      'Initial meeting to discuss your home buying goals, budget, and timeline.',
        duration_minutes: 60,
        buffer_minutes:   15,
        is_active:        true,
        display_order:    1,
      },
      {
        name:             'Property Showing',
        description:      'Tour one or more properties with Karsten.',
        duration_minutes: 60,
        buffer_minutes:   30,
        is_active:        true,
        display_order:    2,
      },
      {
        name:             'Offer Review',
        description:      'Review and discuss an offer on a property.',
        duration_minutes: 30,
        buffer_minutes:   15,
        is_active:        true,
        display_order:    3,
      },
    ];

    const { error: typeErr } = await db.from('appointment_types').insert(types);
    if (typeErr) { console.error('Error seeding appointment types:', typeErr.message); process.exit(1); }
    console.log('✓ 3 appointment types created');
  }

  console.log('\nDone! Karsten\'s schedule is ready.');
}

main();
