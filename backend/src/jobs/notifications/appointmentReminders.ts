import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../lib/db';
import { createNotification } from './notificationWorker';

/**
 * appointmentReminders.ts
 *
 * Polls every 30 minutes for confirmed appointments that need
 * a 24-hour or 1-hour reminder sent.
 *
 * Uses a polling window (±1 hour / ±5 minutes) rather than scheduling
 * individual jobs per appointment. This approach:
 *   - Handles reschedules automatically (no orphaned scheduled jobs)
 *   - Is resilient to worker restarts (idempotent — reminder_Nh_sent flag prevents duplicates)
 *   - Requires no job cleanup when appointments are cancelled
 *
 * BullMQ queue:  'appointment-reminders'
 * Repeat:        Every 30 minutes
 * Concurrency:   1
 */

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const appointmentReminderQueue = new Queue('appointment-reminders', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 20 },
  },
});

export const appointmentReminderWorker = new Worker(
  'appointment-reminders',
  reminderHandler,
  { connection, concurrency: 1 },
);

// -------------------------------------------------------------------------
// Register recurring job (called once on startup)
// -------------------------------------------------------------------------

export async function setupAppointmentReminderScheduler(): Promise<void> {
  await appointmentReminderQueue.add(
    'check-reminders',
    {},
    {
      repeat:  { every: 30 * 60 * 1000 }, // every 30 minutes
      jobId:   'appointment-reminder-check',
    },
  );
  console.log('[appointmentReminders] Reminder scheduler registered (every 30 min)');
}

// -------------------------------------------------------------------------
// reminderHandler — runs every 30 minutes
// -------------------------------------------------------------------------

async function reminderHandler(job: Job): Promise<void> {
  const now = new Date();

  await Promise.all([
    send24HourReminders(now),
    send1HourReminders(now),
  ]);
}

// -------------------------------------------------------------------------
// 24-hour reminders
// Fires for appointments starting between now+23h and now+25h
// -------------------------------------------------------------------------

async function send24HourReminders(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: appointments } = await db
    .from('appointments')
    .select(`
      id,
      client_id,
      confirmed_start,
      confirmed_end,
      appointment_types ( name ),
      related_listing_id,
      related_listing_type
    `)
    .eq('status', 'confirmed')
    .eq('reminder_24h_sent', false)
    .gte('confirmed_start', windowStart.toISOString())
    .lte('confirmed_start', windowEnd.toISOString());

  if (!appointments || appointments.length === 0) return;

  const agentUser = await getAgentUser();

  for (const appt of appointments) {
    const typeName  = (appt.appointment_types as any)?.name ?? 'Appointment';
    const startTime = formatDateTime(appt.confirmed_start);

    // Notify client
    await createNotification(
      appt.client_id,
      'appointment_reminder_24h',
      'Appointment Tomorrow',
      `Your ${typeName} is scheduled for ${startTime}`,
      { appointment_id: appt.id },
    );

    // Notify agent
    if (agentUser) {
      const clientName = await getClientName(appt.client_id);
      await createNotification(
        agentUser.id,
        'appointment_reminder_24h',
        'Appointment Tomorrow',
        `${typeName} with ${clientName} at ${startTime}`,
        { appointment_id: appt.id },
      );
    }

    // Mark sent (update before notifying to prevent double-send on retry)
    await db
      .from('appointments')
      .update({ reminder_24h_sent: true })
      .eq('id', appt.id);
  }

  if (appointments.length > 0) {
    console.log(`[appointmentReminders] Sent 24h reminders for ${appointments.length} appointments`);
  }
}

// -------------------------------------------------------------------------
// 1-hour reminders
// Fires for appointments starting between now+55min and now+65min
// -------------------------------------------------------------------------

async function send1HourReminders(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: appointments } = await db
    .from('appointments')
    .select(`
      id,
      client_id,
      confirmed_start,
      appointment_types ( name )
    `)
    .eq('status', 'confirmed')
    .eq('reminder_1h_sent', false)
    .gte('confirmed_start', windowStart.toISOString())
    .lte('confirmed_start', windowEnd.toISOString());

  if (!appointments || appointments.length === 0) return;

  const agentUser = await getAgentUser();

  for (const appt of appointments) {
    const typeName  = (appt.appointment_types as any)?.name ?? 'Appointment';
    const startTime = formatTime(appt.confirmed_start);

    // Client 1-hour reminder
    await createNotification(
      appt.client_id,
      'appointment_reminder_1h',
      'Appointment in 1 Hour',
      `Your ${typeName} starts at ${startTime}`,
      { appointment_id: appt.id },
    );

    // Agent 1-hour reminder
    if (agentUser) {
      const clientName = await getClientName(appt.client_id);
      await createNotification(
        agentUser.id,
        'appointment_reminder_1h',
        'Appointment in 1 Hour',
        `${typeName} with ${clientName} at ${startTime}`,
        { appointment_id: appt.id },
      );
    }

    await db
      .from('appointments')
      .update({ reminder_1h_sent: true })
      .eq('id', appt.id);
  }

  if (appointments.length > 0) {
    console.log(`[appointmentReminders] Sent 1h reminders for ${appointments.length} appointments`);
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

let cachedAgentUser: { id: string } | null = null;

async function getAgentUser(): Promise<{ id: string } | null> {
  if (cachedAgentUser) return cachedAgentUser;
  const { data } = await db
    .from('users')
    .select('id')
    .eq('role', 'agent')
    .single();
  cachedAgentUser = data;
  return data;
}

async function getClientName(clientId: string): Promise<string> {
  const { data } = await db
    .from('users')
    .select('full_name')
    .eq('id', clientId)
    .single();
  return data?.full_name ?? 'Client';
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
    timeZoneName: 'short',
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour:    'numeric',
    minute:  '2-digit',
    timeZoneName: 'short',
  });
}
