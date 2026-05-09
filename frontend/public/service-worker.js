/**
 * service-worker.js
 *
 * PWA Service Worker for Kaptivating Homes.
 * Handles background push notifications and notification click events.
 *
 * Registered by: frontend/src/lib/pushSubscription.ts
 * Scope: /  (entire site)
 */

const APP_NAME = 'Kaptivating Homes';

// -------------------------------------------------------------------------
// Install & Activate
// -------------------------------------------------------------------------

self.addEventListener('install', () => {
  // Skip waiting so the new service worker activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open pages immediately
  event.waitUntil(self.clients.claim());
});

// -------------------------------------------------------------------------
// push — display the notification
// -------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback for plain-text push (shouldn't happen but defensive)
    payload = {
      title: APP_NAME,
      body:  event.data.text(),
      data:  { url: '/' },
    };
  }

  const options = {
    body:      payload.body     ?? '',
    icon:      payload.icon     ?? '/icons/icon-192.png',
    badge:     payload.badge    ?? '/icons/badge-72.png',
    tag:       payload.tag      ?? 'kaptivating-homes',
    data:      payload.data     ?? { url: '/' },
    renotify:  false,   // don't vibrate again if same tag already showing
    requireInteraction: shouldRequireInteraction(payload.data?.type),
    actions:   buildActions(payload.data?.type),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// -------------------------------------------------------------------------
// notificationclick — handle tap / action button click
// -------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data   = event.notification.data ?? {};
  const action = event.action; // empty string = body tap, or action id

  // Determine target URL
  let targetUrl = data.url ?? '/';

  // Action-specific overrides
  if (action === 'reply') {
    targetUrl = data.url ?? '/portal/messages';
  } else if (action === 'view') {
    targetUrl = data.url ?? '/';
  } else if (action === 'dismiss') {
    return; // Just close — already done above
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If a tab matching this URL is already open → focus it
        const existing = windowClients.find(
          (client) => client.url.includes(new URL(targetUrl, self.location.origin).pathname)
        );
        if (existing) {
          existing.postMessage({
            type: 'NOTIFICATION_CLICK',
            notification_id: data.notification_id,
            url: targetUrl,
          });
          return existing.focus();
        }
        // Otherwise open a new tab
        return self.clients.openWindow(targetUrl);
      })
  );
});

// -------------------------------------------------------------------------
// notificationclose — user dismissed without clicking (analytics hook)
// -------------------------------------------------------------------------

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data ?? {};
  // Could send a beacon to mark notification as dismissed for analytics
  // For now just log in development
  if (self.location.hostname === 'localhost') {
    console.log('[SW] Notification dismissed:', data.notification_id);
  }
});

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Notifications where staying visible until interaction makes sense.
 * (Only on desktop — iOS/Android always require interaction anyway)
 */
function shouldRequireInteraction(type) {
  return [
    'time_suggestion_received',
    'appointment_confirmed',
  ].includes(type);
}

/**
 * Action buttons shown on the notification (desktop Chrome/Edge only).
 * Max 2 actions.
 */
function buildActions(type) {
  if (type === 'new_message') {
    return [
      { action: 'view',    title: 'View Message' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  }
  if (type === 'time_suggestion_received') {
    return [
      { action: 'view',    title: 'Review Request' },
      { action: 'dismiss', title: 'Later' },
    ];
  }
  if (type === 'appointment_reminder_1h' || type === 'appointment_reminder_24h') {
    return [
      { action: 'view', title: 'View Details' },
    ];
  }
  return [];
}
