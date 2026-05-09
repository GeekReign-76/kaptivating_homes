import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../lib/db';
import { sendPushToUser, buildPushPayload } from './pushSender';

/**
 * notificationWorker.ts
 *
 * Central BullMQ worker that processes the 'notifications' queue.
 *
 * Every notification in the system flows through here regardless of type.
 * The worker:
 *   1. Fetches the notification record from the DB
 *   2. Emits a Socket.io 'notification' event (in-app real-time delivery)
 *   3. Sends a web push to all of the user's subscriptions
 *   4. Falls back to email if push fails
 *   5. Updates the notification status (sent / failed)
 */

// -------------------------------------------------------------------------
// Queue & Worker setup
// -------------------------------------------------------------------------

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 200 },
  },
});

export const notificationWorker = new Worker(
  'notifications',
  processNotification,
  { connection, concurrency: 10 },
);

notificationWorker.on('failed', (job, err) => {
  console.error(`[notificationWorker] Job ${job?.id} failed:`, err.message);
});

// -------------------------------------------------------------------------
// Job data shape
// -------------------------------------------------------------------------

export interface NotificationJobData {
  notification_id: string; // ID in the notifications table
}

// -------------------------------------------------------------------------
// processNotification — main job handler
// -------------------------------------------------------------------------

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { notification_id } = job.data;

  // 1. Fetch notification record
  const { data: notification, error } = await db
    .from('notifications')
    .select('*')
    .eq('id', notification_id)
    .single();

  if (error || !notification) {
    // Notification deleted or never existed — not an error we should retry
    return;
  }

  if (notification.status !== 'pending') {
    // Already processed (duplicate job) — skip
    return;
  }

  try {
    // 2. Real-time in-app delivery via Socket.io
    await emitInApp(notification);

    // 3. Web push delivery
    const payload = buildPushPayload(
      notification.id,
      notification.type,
      notification.title,
      notification.body ?? '',
      notification.data ?? {},
    );

    const pushDelivered = await sendPushToUser(notification.user_id, payload);

    // 4. Email fallback if push failed and this type warrants email
    if (!pushDelivered && shouldEmailFallback(notification.type)) {
      await queueEmailFallback(notification);
    }

    // 5. Mark as sent
    await db
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', notification_id);

  } catch (err) {
    // Mark as failed — BullMQ will retry per job options
    await db
      .from('notifications')
      .update({ status: 'failed' })
      .eq('id', notification_id);

    throw err;
  }
}

// -------------------------------------------------------------------------
// createNotification — helper called throughout the app to create and queue
// -------------------------------------------------------------------------

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
  channel: 'push' | 'email' | 'in_app' = 'push',
): Promise<void> {
  const { data: notification, error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      data,
      channel,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !notification) {
    console.error('[createNotification] Failed to insert notification:', error?.message);
    return;
  }

  await notificationQueue.add(
    type,
    { notification_id: notification.id },
    { priority: priorityForType(type) },
  );
}

// -------------------------------------------------------------------------
// Socket.io in-app delivery
// -------------------------------------------------------------------------

async function emitInApp(notification: Record<string, any>): Promise<void> {
  try {
    const { getIO } = await import('../../server');
    const io = getIO();
    io.to(`user:${notification.user_id}`).emit('notification', {
      id:         notification.id,
      type:       notification.type,
      title:      notification.title,
      body:       notification.body,
      data:       notification.data,
      created_at: notification.created_at,
    });
  } catch {
    // Socket.io unavailable (tests, worker-only mode) — silently skip
  }
}

// -------------------------------------------------------------------------
// Email fallback
// -------------------------------------------------------------------------

// Notification types that warrant an email fallback when push fails
const EMAIL_FALLBACK_TYPES = new Set([
  'new_message',
  'appointment_confirmed',
  'appointment_reminder_24h',
  'appointment_cancelled_agent',
  'appointment_cancelled_client',
  'time_suggestion_received',
  'time_suggestion_response',
  'new_listing_match',
]);

function shouldEmailFallback(type: string): boolean {
  return EMAIL_FALLBACK_TYPES.has(type);
}

// Email queue (SendGrid) — separate worker handles actual sending
const emailQueue = new Queue('email', { connection });

async function queueEmailFallback(notification: Record<string, any>): Promise<void> {
  // Fetch user email
  const { data: user } = await db
    .from('users')
    .select('email, full_name')
    .eq('id', notification.user_id)
    .single();

  if (!user?.email) return;

  await emailQueue.add('send-email', {
    to:           user.email,
    to_name:      user.full_name ?? '',
    subject:      notification.title,
    body:         notification.body,
    type:         notification.type,
    data:         notification.data,
    notification_id: notification.id,
  }, {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 10_000 },
  });
}

// -------------------------------------------------------------------------
// Priority — time-sensitive notifications go first
// -------------------------------------------------------------------------

function priorityForType(type: string): number {
  const HIGH_PRIORITY = new Set([
    'appointment_reminder_1h',
    'new_chat',
  ]);
  const MEDIUM_PRIORITY = new Set([
    'new_message',
    'appointment_confirmed',
    'appointment_reminder_24h',
    'appointment_cancelled_agent',
    'appointment_cancelled_client',
    'time_suggestion_received',
    'time_suggestion_response',
  ]);

  if (HIGH_PRIORITY.has(type))   return 1;
  if (MEDIUM_PRIORITY.has(type)) return 2;
  return 3; // low — listing matches, sync alerts, etc.
}
