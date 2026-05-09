/**
 * pushSubscription.ts
 *
 * Browser-side helper for registering and managing Web Push subscriptions.
 *
 * Usage:
 *   import { requestPushPermission, unsubscribeFromPush } from '@/lib/pushSubscription';
 *
 *   // After user logs in — request permission
 *   await requestPushPermission();
 *
 *   // When user explicitly opts out or logs out
 *   await unsubscribeFromPush();
 */

const SERVICE_WORKER_PATH = '/service-worker.js';
const VAPID_PUBLIC_KEY    = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

// -------------------------------------------------------------------------
// requestPushPermission
//
// Full flow:
//   1. Register service worker (idempotent — safe to call multiple times)
//   2. Request browser permission (shows system dialog)
//   3. Subscribe to push via PushManager
//   4. Send subscription to backend
// -------------------------------------------------------------------------

export async function requestPushPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] Web Push not supported in this browser');
    return 'unsupported';
  }

  // 1. Register service worker
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('[push] Service worker registration failed:', err);
    return 'unsupported';
  }

  // 2. Check existing permission
  const existingPermission = Notification.permission;
  if (existingPermission === 'denied') return 'denied';

  // 3. Request permission (only shows dialog if 'default')
  const permission = existingPermission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') return 'denied';

  // 4. Get or create push subscription
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    } catch (err) {
      console.error('[push] Failed to subscribe to push:', err);
      return 'denied';
    }
  }

  // 5. Send subscription to backend
  await sendSubscriptionToBackend(subscription);

  return 'granted';
}

// -------------------------------------------------------------------------
// unsubscribeFromPush
//
// Called on logout or explicit opt-out.
// Unsubscribes in the browser and removes from backend.
// -------------------------------------------------------------------------

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;

  // Unsubscribe in browser
  await subscription.unsubscribe();

  // Remove from backend
  try {
    await fetch('/api/v1/push/subscribe', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ endpoint }),
    });
  } catch (err) {
    console.warn('[push] Failed to remove subscription from backend:', err);
  }
}

// -------------------------------------------------------------------------
// sendSubscriptionToBackend
// -------------------------------------------------------------------------

async function sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON();

  await fetch('/api/v1/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint:   subscription.endpoint,
      p256dh_key: subscriptionJson.keys?.p256dh,
      auth_key:   subscriptionJson.keys?.auth,
      user_agent: navigator.userAgent,
    }),
  });
}

// -------------------------------------------------------------------------
// NOTIFICATION_CLICK message handler
//
// Service worker posts this message when user taps a notification while
// the app is open. The app can use it to update unread counts or navigate.
// Call setupNotificationClickHandler() in your root layout.
// -------------------------------------------------------------------------

export function setupNotificationClickHandler(
  onNotificationClick: (notificationId: string, url: string) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      onNotificationClick(event.data.notification_id, event.data.url);
    }
  };

  navigator.serviceWorker?.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker?.removeEventListener('message', handler);
  };
}

// -------------------------------------------------------------------------
// urlBase64ToUint8Array — converts VAPID public key for PushManager
// -------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}
