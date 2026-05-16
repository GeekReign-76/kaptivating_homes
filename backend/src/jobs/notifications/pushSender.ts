import webpush from 'web-push';
import { db } from '../../lib/db';

/**
 * pushSender.ts
 *
 * Handles the actual delivery of a Web Push notification to a user.
 * Manages subscription cleanup (410 Gone / 404 Not Found → remove subscription).
 * Falls back to email if all push attempts fail.
 */

// -------------------------------------------------------------------------
// Initialize VAPID keys (called once on server startup)
// -------------------------------------------------------------------------

export function initWebPush(): void {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const mailto     = process.env.VAPID_MAILTO;

  if (!publicKey || !privateKey || !mailto) {
    console.warn('[push] VAPID keys not configured — web push notifications disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO to enable.');
    return;
  }

  webpush.setVapidDetails(mailto, publicKey, privateKey);
}

// -------------------------------------------------------------------------
// Push payload shape
// -------------------------------------------------------------------------

export interface PushPayload {
  title:  string;
  body:   string;
  icon?:  string;
  badge?: string;
  tag?:   string;        // browser deduplicates notifications with same tag
  data: {
    url:             string;    // deep link opened on notification click
    notification_id: string;    // DB notification ID (for marking read on click)
    type:            string;    // notification type
  };
}

// -------------------------------------------------------------------------
// sendPushToUser
//
// Attempts to push to every subscription the user has.
// Returns true if at least one subscription was successfully delivered to.
// Returns false if all subscriptions failed (triggers email fallback).
// -------------------------------------------------------------------------

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) {
    return false; // No subscriptions — caller handles email fallback
  }

  const payloadString = JSON.stringify({
    ...payload,
    icon:  payload.icon  ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/badge-72.png',
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payloadString))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return successCount > 0;
}

// -------------------------------------------------------------------------
// sendToSubscription — send to a single push subscription
// -------------------------------------------------------------------------

async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh_key: string; auth_key: string },
  payloadString: string,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth:   sub.auth_key,
        },
      },
      payloadString,
      { TTL: 86400 } // 24 hours — browser delivers when user comes online
    );

    // Update last_used_at on success
    await db
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', sub.id);

    return true;

  } catch (err: any) {
    const statusCode = err?.statusCode;

    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or revoked — remove it
      await db.from('push_subscriptions').delete().eq('id', sub.id);
      console.log(`[pushSender] Removed expired subscription ${sub.id} (${statusCode})`);
    } else {
      console.error(`[pushSender] Push failed for subscription ${sub.id}:`, err?.message);
    }

    return false;
  }
}

// -------------------------------------------------------------------------
// buildPushPayload — constructs the PushPayload for each notification type
// -------------------------------------------------------------------------

export function buildPushPayload(
  notificationId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, string>,
): PushPayload {
  return {
    title,
    body:  truncate(body, 120),
    tag:   buildTag(type, data),
    data: {
      url:             buildDeepLink(type, data),
      notification_id: notificationId,
      type,
    },
  };
}

// Build notification tag for deduplication
// Same tag = browser replaces the old notification with the new one
function buildTag(type: string, data: Record<string, string>): string {
  switch (type) {
    case 'new_message':
      return `thread-${data.thread_id}`;
    case 'new_chat':
      return `chat-${data.session_id}`;
    case 'appointment_confirmed':
    case 'appointment_reminder_24h':
    case 'appointment_reminder_1h':
    case 'appointment_cancelled_agent':
    case 'appointment_cancelled_client':
    case 'time_suggestion_received':
    case 'time_suggestion_response':
      return `appointment-${data.appointment_id}`;
    case 'new_listing_match':
      return `search-match-${data.saved_search_id}`;
    case 'sync_failed':
      return `sync-failed-${data.market_id}`;
    default:
      return type;
  }
}

// Build deep link URL for notification click
function buildDeepLink(type: string, data: Record<string, string>): string {
  switch (type) {
    case 'new_message':
    case 'document_shared':
      return `/portal/messages?thread=${data.thread_id}`;
    case 'new_chat':
      return `/dashboard/chat?session=${data.session_id}`;
    case 'appointment_confirmed':
    case 'appointment_reminder_24h':
    case 'appointment_reminder_1h':
    case 'time_suggestion_response':
      return `/portal/appointments/${data.appointment_id}`;
    case 'appointment_cancelled_agent':
      return `/portal/appointments`;
    case 'appointment_cancelled_client':
    case 'time_suggestion_received':
      return `/dashboard/calendar?appointment=${data.appointment_id}`;
    case 'new_listing_match':
      return `/listings/${data.listing_id}`;
    case 'sync_failed':
      return `/dashboard/markets`;
    default:
      return '/';
  }
}

// -------------------------------------------------------------------------
// sendPushToAllAgents — used by health monitor alerts
//
// Sends to every push subscription in the table.
// In this app only agents subscribe via the dashboard, so this effectively
// reaches all admin devices without needing a role join.
// -------------------------------------------------------------------------

export async function sendPushToAllAgents(opts: {
  title: string;
  body:  string;
  url:   string;
}): Promise<void> {
  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key');

  if (!subscriptions || subscriptions.length === 0) return;

  const payloadString = JSON.stringify({
    title: opts.title,
    body:  truncate(opts.body, 120),
    icon:  '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag:   'server-alert',
    data: {
      url:             opts.url,
      notification_id: 'system',
      type:            'server_alert',
    },
  });

  await Promise.allSettled(
    subscriptions.map(sub => sendToSubscription(sub, payloadString))
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}
