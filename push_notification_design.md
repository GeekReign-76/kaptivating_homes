# Push Notification Architecture

**Last updated:** 2026-04-29

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Choice: Web Push + VAPID](#2-technology-choice-web-push--vapid)
3. [End-to-End Push Flow](#3-end-to-end-push-flow)
4. [VAPID Key Setup](#4-vapid-key-setup)
5. [Subscription Lifecycle](#5-subscription-lifecycle)
6. [Notification Pipeline](#6-notification-pipeline)
7. [Notification Types & Payloads](#7-notification-types--payloads)
8. [Saved Search Matching](#8-saved-search-matching)
9. [Appointment Reminder Scheduler](#9-appointment-reminder-scheduler)
10. [Listing Status Notifier](#10-listing-status-notifier)
11. [In-App Notification Center](#11-in-app-notification-center)
12. [PWA Service Worker](#12-pwa-service-worker)
13. [Email Fallback](#13-email-fallback)
14. [Agent Dashboard PWA](#14-agent-dashboard-pwa)
15. [File Structure](#15-file-structure)

---

## 1. Overview

The notification system has three delivery channels:

| Channel | When used | Reaches user when... |
|---|---|---|
| **Web Push** | Primary channel | Tab is closed, app is in background |
| **In-App** | Always (real-time via Socket.io) | User is actively on the site |
| **Email** | Fallback only | Push subscription expired or permission denied |

The push stack is built on the **Web Push Protocol** (RFC 8030) using the `web-push` npm library and **VAPID** authentication keys. No Firebase SDK is required — VAPID works natively across Chrome, Firefox, Edge, and Safari (iOS 16.4+).

---

## 2. Technology Choice: Web Push + VAPID

**Why not FCM SDK?**
- FCM is just Google's implementation of Web Push. The `web-push` library speaks the same Web Push Protocol and routes to Chrome through FCM automatically — no Firebase SDK needed.
- VAPID works across all browsers (Chrome, Firefox, Edge, Safari) from one implementation.
- Avoids vendor lock-in to Firebase.

**Why not native mobile push?**
- The agent's dashboard runs as a PWA (Progressive Web App). Web Push reaches them on any device via the browser without requiring an App Store release.
- Clients use the web portal — Web Push works there too.
- Native iOS/Android app can be added later (Phase 3). That integration is separate.

---

## 3. End-to-End Push Flow

```
1. USER GRANTS PERMISSION
   ─────────────────────────────────────────────────────────
   Browser → ServiceWorker registers push subscription
   Frontend → POST /api/v1/push/subscribe
   API → stores endpoint + keys in push_subscriptions table

2. EVENT TRIGGERS A NOTIFICATION
   ─────────────────────────────────────────────────────────
   e.g. Agent sends a message in a thread
   API → INSERT INTO notifications (status: 'pending')
   API → add job to BullMQ 'notifications' queue

3. NOTIFICATION WORKER PROCESSES JOB
   ─────────────────────────────────────────────────────────
   Worker → reads notification from DB
   Worker → fetches user's push_subscriptions
   Worker → calls web-push.sendNotification() for each subscription
   Worker → also emits Socket.io 'notification' event (if user is connected)
   Worker → marks notification status: 'sent'

4. BROWSER RECEIVES PUSH
   ─────────────────────────────────────────────────────────
   Push Service (Google/Mozilla/Apple) → delivers to browser
   Service Worker → wakes up, handles 'push' event
   Service Worker → calls self.registration.showNotification()
   User sees notification in OS tray

5. USER TAPS NOTIFICATION
   ─────────────────────────────────────────────────────────
   Service Worker → handles 'notificationclick' event
   Service Worker → reads notification.data.url
   Service Worker → opens / focuses the correct page
```

---

## 4. VAPID Key Setup

VAPID keys are generated once and stored as environment variables. Never rotate them unless absolutely necessary — rotating invalidates all existing push subscriptions.

**Generate keys (run once):**
```bash
npx web-push generate-vapid-keys
```

**Environment variables:**
```
VAPID_PUBLIC_KEY=BNcRdreALRFXTkOOUHK1EtdlTs...
VAPID_PRIVATE_KEY=ZD3pRxuGmHe...
VAPID_MAILTO=mailto:admin@kaptivatinghomes.com
```

**Frontend:** The public key is exposed to the client (it's public — this is safe):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNcRdreALRFXTkOOUHK1EtdlTs...
```

---

## 5. Subscription Lifecycle

### Subscribing
1. User clicks "Enable notifications" (or we prompt after a meaningful interaction)
2. Browser shows the system permission dialog
3. If granted: `navigator.serviceWorker.ready` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
4. Frontend sends subscription object to `POST /api/v1/push/subscribe`
5. Backend stores in `push_subscriptions` table

### Subscription expiry / 410 Gone
- Push subscriptions can expire or be revoked by the user
- When `web-push.sendNotification()` returns `StatusCode 410 (Gone)` or `404 (Not Found)`:
  - Remove the subscription from `push_subscriptions` table immediately
  - Attempt email fallback for this notification

### Multiple subscriptions per user
A user may have multiple subscriptions (home computer, work computer, phone browser). We store all of them. Push is sent to every active subscription — the browser deduplicates if the user has multiple tabs open (via `notification.tag`).

---

## 6. Notification Pipeline

Every notification follows this path regardless of event type:

```
Event occurs
    │
    ▼
createNotification(userId, type, title, body, data)
    │  Writes to notifications table (status: pending)
    │  Adds job to BullMQ 'notifications' queue
    ▼
notificationWorker processes job
    │
    ├── Emit Socket.io 'notification' event → user:{userId} room
    │     (real-time delivery if user is connected)
    │
    ├── Fetch push_subscriptions for user
    │     │
    │     ├── For each subscription:
    │     │     └── web-push.sendNotification()
    │     │           ├── Success → mark subscription last_used_at
    │     │           └── 410/404 → delete subscription from DB
    │     │
    │     └── If NO subscriptions or ALL failed:
    │           └── Queue email fallback job
    │
    └── Update notification status: 'sent' or 'failed'
```

---

## 7. Notification Types & Payloads

All notification payloads follow the same shape. The `data.url` field drives the service worker's deep-link behavior on click.

| Type | Title | Body | Deep link |
|---|---|---|---|
| `new_message` | "New message from [Name]" | First 100 chars of message | `/portal/messages?thread=[id]` |
| `new_chat` | "New chat from [Name or 'a visitor']" | First 100 chars | `/dashboard/chat?session=[id]` |
| `appointment_confirmed` | "Appointment Confirmed" | "Your [type] is confirmed for [date/time]" | `/portal/appointments/[id]` |
| `appointment_reminder_24h` | "Appointment Tomorrow" | "[type] tomorrow at [time]" | `/portal/appointments/[id]` |
| `appointment_reminder_1h` | "Appointment in 1 Hour" | "[type] at [time]" | `/portal/appointments/[id]` |
| `appointment_cancelled_agent` | "Appointment Cancelled" | "Your [date] appointment was cancelled" | `/portal/appointments` |
| `appointment_cancelled_client` | "Appointment Cancelled" | "[Client] cancelled their [date] appointment" | `/dashboard/calendar` |
| `time_suggestion_received` | "New Time Request" | "[Client] requested [date/time]" | `/dashboard/calendar?appointment=[id]` |
| `time_suggestion_response` | "Counter-Proposal Received" | "Agent suggested [date/time] instead" | `/portal/appointments/[id]` |
| `new_listing_match` | "New match for '[Search Name]'" | "[address], [city] — $[price]" | `/listings/[id]` |
| `document_shared` | "Document Shared" | "Agent shared [filename]" | `/portal/messages?thread=[id]` |
| `sync_failed` | "MLS Sync Failed" | "[MLS name] sync failed. Last sync: [time]" | `/dashboard/markets` |

---

## 8. Saved Search Matching

After every incremental or full sync, new listings are checked against all active saved searches.

### Matching Job Flow

```
Sync completes with new_listings > 0
    │
    ▼
savedSearchMatcher job queued
    │
    ├── Fetch all saved searches where notify_on_new_match = true
    ├── For each new listing from this sync:
    │     └── For each saved search:
    │           └── listingMatchesSearch(listing, filters)
    │                 ├── Match → createNotification for that user
    │                 └── No match → skip
    └── Update saved_search.last_checked_at = now()
```

### Match Algorithm

Filters are evaluated in order from cheapest to most expensive check:
1. `states` — quick array include
2. `property_types` — array include
3. `min_price / max_price` — numeric range
4. `min_beds / min_baths` — numeric minimum
5. `cities` — case-insensitive string match
6. `min_sqft / max_sqft` — numeric range
7. `keywords` — substring search on description (most expensive — checked last)

Short-circuits on first failure (returns `false` immediately).

### Batching to avoid notification spam

If a sync produces 50 new listings that all match the same saved search, the user should receive **one** notification ("5 new listings match your search 'Columbia 3BR'"), not 50.

The matcher groups matches by `(user_id, saved_search_id)` and creates a single notification per user per search per sync run.

---

## 9. Appointment Reminder Scheduler

Runs as a BullMQ repeatable job every **30 minutes**.

### 24-Hour Reminder Logic

```sql
SELECT * FROM appointments
WHERE status = 'confirmed'
  AND reminder_24h_sent = false
  AND confirmed_start BETWEEN (now() + interval '23 hours') 
                          AND (now() + interval '25 hours')
```

For each result:
1. Send notification to both agent and client
2. Set `reminder_24h_sent = true`

### 1-Hour Reminder Logic

```sql
SELECT * FROM appointments
WHERE status = 'confirmed'
  AND reminder_1h_sent = false
  AND confirmed_start BETWEEN (now() + interval '55 minutes') 
                          AND (now() + interval '65 minutes')
```

For each result:
1. Send notification to both agent and client
2. Set `reminder_1h_sent = true`

### Why 30-minute polling instead of exact scheduling?

Exact scheduling (e.g., schedule a job 24h before each appointment) creates thousands of individual jobs and is fragile when appointments are rescheduled. Polling every 30 minutes with a ±1 hour window is simple, reliable, and handles reschedules automatically — worst case the reminder is 30 minutes late.

---

## 10. Listing Status Notifier

Handles the `mls-listing-status-changed` queue jobs queued by the sync system.

### Per-listing flow

```
listing-status-changed job: { listing_id, old_status, new_status, address, city }
    │
    ├── Find all users with this listing saved (saved_properties table)
    │     └── For each user:
    │           └── createNotification(userId, 'listing_status_changed', ...)
    │
    └── Find saved searches that would have matched this listing
          └── Notify those users: "A home matching '[search name]' is now [status]"
```

---

## 11. In-App Notification Center

The notification center is the bell icon in the portal and dashboard navbars.

### Real-time updates
- When the notification worker sends a push, it also emits a Socket.io `notification` event to `user:{userId}`
- The frontend listens and increments the unread badge count immediately
- No polling required

### Notification center panel
- `GET /api/v1/notifications?limit=20` loads the first page
- Grouped by date: "Today", "Yesterday", "This Week"
- Each item shows: icon (type-based), title, body, timestamp, unread dot
- Clicking an item: marks read + navigates to `data.url`
- "Mark all read" button: `POST /api/v1/notifications/read-all`

### Unread count badge
- Returned in `meta.unread_count` on the notifications list response
- Updated in real-time via Socket.io `notification` event

---

## 12. PWA Service Worker

The service worker (`/public/service-worker.js`) handles two key events:

### `push` event — show the notification
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data:  data.data,      // { url: '/portal/messages?thread=...' }
      tag:   data.tag,       // deduplicates notifications of same type
      renotify: false,
    })
  );
});
```

### `notificationclick` event — handle the tap
```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if open
        const existing = windowClients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        // Otherwise open new tab
        return clients.openWindow(url);
      })
  );
});
```

---

## 13. Email Fallback

When push fails (no subscriptions, all subscriptions expired, or permission denied), an email is sent via **Twilio SendGrid**.

Email fallback fires for:
- New message (if push fails)
- Appointment confirmed (always — email is the calendar invite delivery mechanism too)
- Appointment reminder 24h (always — important enough to email even if push works)
- Appointment cancelled (always)
- New listing match (if push fails)

Email is **NOT** used for:
- 1-hour appointment reminders (too late to be useful via email)
- Real-time chat notifications (too transient)
- In-app system messages

---

## 14. Agent Dashboard PWA

The agent's dashboard is a PWA so push notifications work on their phone without an app store.

**Setup in `layout.tsx`:**
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0f172a" />
```

**`manifest.json`:**
```json
{
  "name": "Kaptivating Homes Dashboard",
  "short_name": "KH Dashboard",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

On mobile (iOS Safari / Android Chrome), the agent sees an "Add to Home Screen" prompt. Once added, the dashboard runs full-screen and receives push notifications even when the browser is backgrounded.

---

## 15. File Structure

```
backend/src/jobs/notifications/
├── notificationWorker.ts       BullMQ worker — processes the notifications queue
├── pushSender.ts               web-push delivery + subscription cleanup
├── savedSearchMatcher.ts       Match new listings against saved searches
├── appointmentReminders.ts     24h and 1h reminder scheduler
└── listingStatusNotifier.ts    Handle listing-status-changed events

frontend/public/
└── service-worker.js           PWA service worker (push + click handling)

frontend/src/lib/
└── pushSubscription.ts         Browser-side subscribe/unsubscribe helper
```
