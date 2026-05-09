# Kaptivating Homes — API Design

**Base URL:** `/api/v1`
**Protocol:** HTTPS + WebSocket (Socket.io)
**Last updated:** 2026-04-29

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Auth Endpoints](#3-auth-endpoints)
4. [Listings (MLS)](#4-listings-mls)
5. [Listing Overrides](#5-listing-overrides)
6. [Manual Listings](#6-manual-listings)
7. [Markets](#7-markets)
8. [Threads & Messages](#8-threads--messages)
9. [Live Chat](#9-live-chat)
10. [Calendar & Availability](#10-calendar--availability)
11. [Appointments](#11-appointments)
12. [Documents](#12-documents)
13. [Blog](#13-blog)
14. [Saved Properties](#14-saved-properties)
15. [Saved Searches](#15-saved-searches)
16. [Push Notifications](#16-push-notifications)
17. [Notifications](#17-notifications)
18. [Dashboard & Leads](#18-dashboard--leads)
19. [Socket.io Event Map](#19-socketio-event-map)
20. [Error Reference](#20-error-reference)

---

## 1. Conventions

### Response Envelope

Every response — success or error — uses the same envelope:

```json
{
  "data": { ... } | [ ... ] | null,
  "error": null | { "code": "NOT_FOUND", "message": "Listing not found" },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 143
  }
}
```

- `data` is `null` on errors
- `error` is `null` on success
- `meta` only present on paginated list responses

### Pagination

All list endpoints support:

| Query param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 100) |
| `sort` | varies | Sort field |
| `order` | `desc` | `asc` or `desc` |

### Auth Levels

| Label | Requirement |
|---|---|
| `public` | No auth required |
| `client` | Valid Supabase JWT (any role) |
| `agent` | Valid Supabase JWT with `role = 'agent'` |

JWT passed as: `Authorization: Bearer <token>`

### Listing Source Identifier

Many endpoints return or accept a `listing_source` field:

| Value | Meaning |
|---|---|
| `mls` | Cached from IDX feed |
| `manual` | Agent-created, off-MLS |

---

## 2. Authentication

Supabase Auth issues JWTs. The API server validates them using Supabase's public JWKS endpoint.

**Client auth flow:** Magic link (email only, no password)
**Agent auth flow:** Email + password

Supabase handles token refresh. The frontend stores the session in an HTTP-only cookie via Supabase's `@supabase/ssr` helper.

---

## 3. Auth Endpoints

### POST `/api/v1/auth/magic-link`
Send a magic link login email to a client.

**Auth:** `public`

**Request:**
```json
{
  "email": "client@example.com",
  "redirect_to": "https://kaptivatinghomes.com/portal"
}
```

**Response:**
```json
{
  "data": { "message": "Check your email for a login link." },
  "error": null
}
```

**Notes:**
- Delegates to Supabase Auth `signInWithOtp`
- If email is new, Supabase creates the `auth.users` record; our API creates the `users` row and a `leads` row on first login (via Supabase Auth webhook)
- `redirect_to` is validated against an allowlist of domains

---

### POST `/api/v1/auth/login`
Agent email + password login.

**Auth:** `public`

**Request:**
```json
{
  "email": "agent@kaptivatinghomes.com",
  "password": "••••••••"
}
```

**Response:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "agent@kaptivatinghomes.com",
      "full_name": "Agent Name",
      "role": "agent"
    },
    "access_token": "eyJ...",
    "expires_at": 1746000000
  },
  "error": null
}
```

---

### POST `/api/v1/auth/logout`
**Auth:** `client`

**Response:**
```json
{ "data": { "message": "Logged out." }, "error": null }
```

---

### GET `/api/v1/auth/me`
Get the current authenticated user's profile.

**Auth:** `client`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "client@example.com",
    "full_name": "Jane Smith",
    "phone": "+18435551234",
    "role": "client",
    "avatar_url": null,
    "preferred_states": ["SC"],
    "preferred_cities": ["Columbia", "Lexington"],
    "created_at": "2026-01-15T10:00:00Z"
  },
  "error": null
}
```

---

### PATCH `/api/v1/auth/me`
Update the current user's profile.

**Auth:** `client`

**Request:** (all fields optional)
```json
{
  "full_name": "Jane Smith",
  "phone": "+18435551234",
  "preferred_states": ["SC"],
  "preferred_cities": ["Columbia"]
}
```

**Response:** Updated user object (same shape as GET `/auth/me`)

---

## 4. Listings (MLS)

All listing endpoints query the `v_listings` unified view — MLS and manual listings in the same shape.

### GET `/api/v1/listings`
Search and filter all active listings.

**Auth:** `public`

**Query Params:**

| Param | Type | Example | Description |
|---|---|---|---|
| `states` | `string` | `SC` or `SC,GA` | Comma-separated state codes |
| `city` | `string` | `Columbia` | City name (partial match) |
| `zip` | `string` | `29201` | ZIP code |
| `min_price` | `number` | `150000` | |
| `max_price` | `number` | `500000` | |
| `min_beds` | `number` | `3` | |
| `min_baths` | `number` | `2` | |
| `property_type` | `string` | `Single Family` | Exact match |
| `min_sqft` | `number` | `1500` | |
| `max_sqft` | `number` | `4000` | |
| `listing_source` | `string` | `mls` or `manual` or `all` | Default: `all` |
| `keywords` | `string` | `pool waterfront` | Full-text search on description |
| `lat` | `number` | `34.0007` | Center point for proximity search |
| `lng` | `number` | `-81.0348` | Center point for proximity search |
| `radius_miles` | `number` | `10` | Radius from lat/lng (requires both) |
| `sort` | `string` | `price` | `price`, `listed_at`, `updated_at` |
| `order` | `string` | `asc` | `asc` or `desc` |
| `page` | `number` | `1` | |
| `limit` | `number` | `20` | Max 100 |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "listing_source": "mls",
      "mls_id": "12345",
      "mls_source": "CMLS",
      "state": "SC",
      "address": "123 Oak Street",
      "city": "Columbia",
      "county": "Richland",
      "zip": "29201",
      "lat": 34.0007,
      "lng": -81.0348,
      "price": 349000,
      "beds": 4,
      "baths": 2.5,
      "half_baths": 1,
      "sqft": 2200,
      "lot_size": 0.35,
      "lot_unit": "acres",
      "year_built": 2005,
      "property_type": "Single Family",
      "status": "Active",
      "description": "Beautiful home in...",
      "photos": [
        { "url": "https://...", "order": 1, "caption": null }
      ],
      "features": { "garage": true, "pool": false },
      "custom_headline": "Price Reduced — Move-In Ready!",
      "highlight_tags": ["Price Reduced"],
      "is_featured": false,
      "is_starred": false,
      "listing_agent_name": "John Doe",
      "listing_office_name": "ABC Realty",
      "listed_at": "2026-03-01T00:00:00Z",
      "updated_at": "2026-04-01T00:00:00Z"
    }
  ],
  "error": null,
  "meta": { "page": 1, "limit": 20, "total": 143 }
}
```

---

### GET `/api/v1/listings/featured`
Returns listings where `is_featured = true`, ordered by agent-set priority. Used for homepage carousel.

**Auth:** `public`

**Query Params:** `limit` (default 6, max 12)

**Response:** Array of listing objects (same shape as above, always `is_featured: true`)

---

### GET `/api/v1/listings/:id`
Get a single listing by ID. Works for both MLS and manual listings (both live in `v_listings`).

**Auth:** `public`

**Response:** Single listing object

**Notes:**
- If agent is authenticated, response includes `agent_notes` field from `listing_overrides` (internal — never in public response)
- Increments a view counter (async, non-blocking) for dashboard analytics

---

### GET `/api/v1/listings/:id/similar`
Returns listings similar to the given one (same city, similar price range, same property type).

**Auth:** `public`

**Query Params:** `limit` (default 4, max 8)

**Response:** Array of listing objects

---

### GET `/api/v1/listings/:id/pdf`
Returns a signed URL to a branded property PDF. Generates on first request, then serves cached version.

**Auth:** `public`

**Response:**
```json
{
  "data": {
    "url": "https://storage.supabase.co/object/sign/...",
    "expires_at": "2026-04-30T12:00:00Z",
    "generated_at": "2026-04-29T10:00:00Z"
  },
  "error": null
}
```

---

### POST `/api/v1/listings/sync`
Trigger a manual MLS sync (overrides the scheduled job).

**Auth:** `agent`

**Request:**
```json
{ "market_id": "uuid" }
```

**Response:**
```json
{
  "data": {
    "job_id": "bull-job-id",
    "status": "queued",
    "message": "Sync queued for CMLS. You will be notified when complete."
  },
  "error": null
}
```

---

## 5. Listing Overrides

Agent-only. Customizes the display of an MLS listing without touching source data.

### GET `/api/v1/listings/:id/override`
**Auth:** `agent`

**Response:**
```json
{
  "data": {
    "listing_id": "uuid",
    "custom_headline": "Motivated Seller — Price Reduced!",
    "highlight_tags": ["Price Reduced", "Hot Deal"],
    "is_featured": true,
    "is_hidden": false,
    "agent_notes": "Client wants quick sale, move-out date flexible",
    "extra_photos": [],
    "extra_documents": [],
    "updated_at": "2026-04-20T09:00:00Z"
  },
  "error": null
}
```

---

### PUT `/api/v1/listings/:id/override`
Create or fully replace the override for a listing.

**Auth:** `agent`

**Request:** (all fields optional — omitted fields are set to null/default)
```json
{
  "custom_headline": "Stunning Lakefront — Just Listed!",
  "highlight_tags": ["Just Listed", "Waterfront"],
  "is_featured": true,
  "is_hidden": false,
  "agent_notes": "Open house scheduled May 10th",
  "extra_photos": [
    { "url": "https://storage...", "order": 10, "caption": "Backyard view" }
  ],
  "extra_documents": [
    { "name": "Floor Plan", "url": "https://storage...", "type": "pdf" }
  ]
}
```

**Response:** Updated override object

---

### DELETE `/api/v1/listings/:id/override`
Remove all overrides, restoring raw MLS display.

**Auth:** `agent`

**Response:** `{ "data": { "message": "Override removed." }, "error": null }`

---

## 6. Manual Listings

Agent-managed off-MLS listings. Displayed identically to MLS listings on the public site.

### GET `/api/v1/manual-listings`
**Auth:** `public` (returns only `is_active = true, status = Active`)
**Auth:** `agent` (returns all statuses including drafts)

**Query Params:** Same filter set as `/listings` plus `status` (agent only: `Draft`, `Active`, `Pending`, `Sold`, `Archived`)

**Response:** Paginated array of listing objects

---

### POST `/api/v1/manual-listings`
Create a new manual listing.

**Auth:** `agent`

**Request:**
```json
{
  "address": "456 Elm Ave",
  "city": "Lexington",
  "state": "SC",
  "zip": "29072",
  "price": 289000,
  "beds": 3,
  "baths": 2,
  "sqft": 1850,
  "year_built": 1998,
  "property_type": "Single Family",
  "title": "Charming Lexington Ranch",
  "description": "...",
  "photos": [],
  "features": { "garage": true, "pool": false },
  "highlight_tags": ["New to Market"],
  "is_featured": false,
  "is_starred": false,
  "status": "Draft"
}
```

**Response:** Created listing object with `id`

---

### GET `/api/v1/manual-listings/:id`
**Auth:** `public` (active only) / `agent` (all)

**Response:** Single listing object

---

### PATCH `/api/v1/manual-listings/:id`
Update any field on a manual listing.

**Auth:** `agent`

**Request:** Any subset of fields from the POST body, plus `status`

**Response:** Updated listing object

---

### DELETE `/api/v1/manual-listings/:id`
**Auth:** `agent`

**Notes:** Soft delete — sets `is_active = false`, `status = Archived`. Hard deletes not allowed to preserve message thread references.

**Response:** `{ "data": { "message": "Listing archived." }, "error": null }`

---

### PATCH `/api/v1/manual-listings/:id/star`
Toggle the `is_starred` flag.

**Auth:** `agent`

**Response:**
```json
{ "data": { "is_starred": true }, "error": null }
```

---

### PATCH `/api/v1/manual-listings/:id/feature`
Toggle the `is_featured` flag.

**Auth:** `agent`

**Response:**
```json
{ "data": { "is_featured": true }, "error": null }
```

---

## 7. Markets

### GET `/api/v1/markets`
**Auth:** `public` (returns only active markets)
**Auth:** `agent` (returns all markets including inactive)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "state": "SC",
      "mls_name": "Consolidated MLS (CMLS)",
      "provider_class": "SCListingProvider",
      "is_active": true,
      "last_synced_at": "2026-04-29T06:00:00Z",
      "sync_interval_hours": 12
    }
  ],
  "error": null
}
```

---

### PATCH `/api/v1/markets/:id`
Enable/disable a market or update sync settings.

**Auth:** `agent`

**Request:**
```json
{
  "is_active": true,
  "sync_interval_hours": 12
}
```

**Response:** Updated market object

---

## 8. Threads & Messages

### GET `/api/v1/threads`
Get message threads.

**Auth:** `client` (own threads only) / `agent` (all threads)

**Query Params:**

| Param | Description |
|---|---|
| `unread_only` | `true` — only threads with unread messages |
| `client_id` | Agent only — filter by specific client |
| `sort` | `last_message_at` (default) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "client": {
        "id": "uuid",
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "avatar_url": null
      },
      "subject": "Re: 123 Oak Street, Columbia SC",
      "related_listing_id": "uuid",
      "related_listing_type": "mls",
      "agent_unread_count": 2,
      "client_unread_count": 0,
      "last_message": {
        "content": "Can we schedule a tour?",
        "sender_role": "client",
        "sent_at": "2026-04-29T14:32:00Z"
      },
      "last_message_at": "2026-04-29T14:32:00Z",
      "created_at": "2026-04-28T10:00:00Z"
    }
  ],
  "error": null,
  "meta": { "page": 1, "limit": 20, "total": 14 }
}
```

---

### POST `/api/v1/threads`
Create a new thread. Typically triggered when a client clicks "Ask About This Property" or the agent initiates outreach.

**Auth:** `client`

**Request:**
```json
{
  "related_listing_id": "uuid",
  "related_listing_type": "mls",
  "initial_message": "Hi, I'm interested in this property. Is it still available?"
}
```

**Response:** Created thread object + the initial message

**Notes:**
- If a thread already exists between this client and agent (optionally for the same listing), returns the existing thread instead of creating a duplicate
- Creates a `leads` record if one doesn't exist for this client

---

### GET `/api/v1/threads/:id`
Get thread detail with the last 50 messages.

**Auth:** `client` (own thread) / `agent`

**Response:**
```json
{
  "data": {
    "thread": { ...thread object... },
    "messages": [ ...message objects... ],
    "has_more_messages": false
  },
  "error": null
}
```

---

### GET `/api/v1/threads/:id/messages`
Paginated message history for a thread.

**Auth:** `client` (own thread) / `agent`

**Query Params:** `page`, `limit` (default 50), `before` (ISO timestamp — load messages before this time, for infinite scroll upward)

**Response:** Paginated array of message objects

---

### POST `/api/v1/threads/:id/messages`
Send a message in a thread.

**Auth:** `client` (own thread) / `agent`

**Request:**
```json
{
  "message_type": "text",
  "content": "Yes, I'd love to schedule a tour this weekend."
}
```

For a property card:
```json
{
  "message_type": "property_card",
  "content": null,
  "metadata": {
    "listing_id": "uuid",
    "listing_type": "mls"
  }
}
```

For a PDF:
```json
{
  "message_type": "pdf",
  "content": null,
  "metadata": {
    "document_id": "uuid"
  }
}
```

**Response:** Created message object

**Notes:**
- Increments unread count on the thread for the other party
- Triggers push notification to recipient (via BullMQ job)
- Socket.io broadcasts `new_message` to recipient if they are connected

---

### PATCH `/api/v1/messages/:id/read`
Mark a single message as read.

**Auth:** `client` (own thread) / `agent`

**Response:**
```json
{ "data": { "read_at": "2026-04-29T15:00:00Z" }, "error": null }
```

**Notes:**
- Also decrements the appropriate `unread_count` on the thread
- Better approach for bulk: POST `/api/v1/threads/:id/read-all` (marks all messages in thread as read at once)

---

### POST `/api/v1/threads/:id/read-all`
Mark all unread messages in a thread as read.

**Auth:** `client` (own thread) / `agent`

**Response:**
```json
{ "data": { "marked_read": 5 }, "error": null }
```

---

## 9. Live Chat

Live chat is for unregistered guests. Sessions are temporary until either closed or converted to a full thread.

### POST `/api/v1/chat/sessions`
Guest initiates a chat session.

**Auth:** `public`

**Request:**
```json
{
  "guest_name": "Mike",
  "guest_email": "mike@example.com",
  "initial_message": "Hi, question about a property on your site",
  "source_path": "/listings/uuid"
}
```

**Response:**
```json
{
  "data": {
    "session_id": "uuid",
    "status": "waiting",
    "agent_online": true
  },
  "error": null
}
```

**Notes:**
- `agent_online` is true if the agent has an active Socket.io connection to the dashboard
- Socket.io emits `new_chat_session` to agent immediately

---

### GET `/api/v1/chat/sessions`
List all chat sessions.

**Auth:** `agent`

**Query Params:** `status` (default: `active,waiting`), `page`, `limit`

**Response:** Paginated array of chat session objects including latest messages

---

### POST `/api/v1/chat/sessions/:id/join`
Agent joins a waiting chat session.

**Auth:** `agent`

**Response:**
```json
{
  "data": {
    "session_id": "uuid",
    "status": "active",
    "agent_joined_at": "2026-04-29T15:05:00Z",
    "messages": [ ...prior messages... ]
  },
  "error": null
}
```

**Notes:**
- Socket.io emits `agent_joined` to the guest

---

### POST `/api/v1/chat/sessions/:id/messages`
Send a message in a chat session.

**Auth:** `public` (guest, validated by session_id match) / `agent`

**Request:**
```json
{
  "content": "Happy to help! Which property are you asking about?"
}
```

**Response:** Created chat message object

---

### PATCH `/api/v1/chat/sessions/:id/close`
Close a chat session without converting it.

**Auth:** `agent`

**Response:** `{ "data": { "status": "closed" }, "error": null }`

---

### POST `/api/v1/chat/sessions/:id/convert`
Convert a chat session into a full messaging thread. Requires the guest to have provided their email.

**Auth:** `agent`

**Request:**
```json
{
  "subject": "Follow-up from live chat"
}
```

**Response:**
```json
{
  "data": {
    "thread_id": "uuid",
    "session_status": "converted",
    "message": "Chat converted. Guest will receive a registration prompt."
  },
  "error": null
}
```

**Notes:**
- Creates a `threads` row linked to a `users` row (created from guest email if they don't have an account)
- Guest receives an email with a magic link to register and access the thread
- Chat messages are imported into the thread as system/text messages

---

## 10. Calendar & Availability

### GET `/api/v1/availability`
Get available booking slots for a given date range. Used by the client-facing booking calendar.

**Auth:** `public`

**Query Params:**

| Param | Required | Description |
|---|---|---|
| `appointment_type_id` | yes | Determines duration + buffer |
| `start_date` | yes | ISO date `2026-05-01` |
| `end_date` | yes | ISO date `2026-05-31` (max 60 days range) |

**Response:**
```json
{
  "data": {
    "appointment_type": {
      "id": "uuid",
      "name": "Home Tour",
      "duration_minutes": 90
    },
    "slots": [
      {
        "date": "2026-05-01",
        "available_times": [
          { "start": "09:00", "end": "10:30" },
          { "start": "11:00", "end": "12:30" },
          { "start": "14:00", "end": "15:30" }
        ]
      },
      {
        "date": "2026-05-02",
        "available_times": []
      }
    ]
  },
  "error": null
}
```

**Notes:**
- Slot calculation: `availability_windows` for the day, minus `availability_blocks`, minus already-confirmed appointments (+ buffer), minus the appointment duration itself
- Slots are returned in the agent's local timezone (configurable in agent settings — default Eastern)

---

### GET `/api/v1/availability/windows`
Get the agent's weekly recurring availability windows.

**Auth:** `agent`

**Response:**
```json
{
  "data": [
    { "id": "uuid", "day_of_week": 1, "start_time": "09:00", "end_time": "18:00", "is_active": true },
    { "id": "uuid", "day_of_week": 2, "start_time": "09:00", "end_time": "18:00", "is_active": true }
  ],
  "error": null
}
```

---

### PUT `/api/v1/availability/windows`
Replace all availability windows (full replacement, not partial update).

**Auth:** `agent`

**Request:**
```json
{
  "windows": [
    { "day_of_week": 1, "start_time": "09:00", "end_time": "18:00" },
    { "day_of_week": 2, "start_time": "09:00", "end_time": "18:00" },
    { "day_of_week": 3, "start_time": "09:00", "end_time": "18:00" },
    { "day_of_week": 4, "start_time": "09:00", "end_time": "18:00" },
    { "day_of_week": 5, "start_time": "09:00", "end_time": "18:00" },
    { "day_of_week": 6, "start_time": "10:00", "end_time": "14:00" }
  ]
}
```

**Response:** Array of updated window objects

---

### GET `/api/v1/availability/blocks`
Get all upcoming blocked dates.

**Auth:** `agent`

**Query Params:** `from` (ISO date, default today), `to` (ISO date, default +90 days)

**Response:** Array of block objects

---

### POST `/api/v1/availability/blocks`
Add a blocked date or time range.

**Auth:** `agent`

**Request:**
```json
{
  "blocked_date": "2026-05-20",
  "start_time": null,
  "end_time": null,
  "reason": "Vacation"
}
```

Block only part of a day:
```json
{
  "blocked_date": "2026-05-10",
  "start_time": "12:00",
  "end_time": "14:00",
  "reason": "Lunch meeting"
}
```

**Response:** Created block object

---

### DELETE `/api/v1/availability/blocks/:id`
Remove a blocked date.

**Auth:** `agent`

**Response:** `{ "data": { "message": "Block removed." }, "error": null }`

---

### GET `/api/v1/appointment-types`
List all active appointment types.

**Auth:** `public`

**Response:** Array of appointment type objects (id, name, description, duration_minutes, color)

---

## 11. Appointments

### POST `/api/v1/appointments`
Book an appointment or suggest a custom time. Requires authenticated client.

**Auth:** `client`

**Request — booking an open slot:**
```json
{
  "appointment_type_id": "uuid",
  "requested_start": "2026-05-03T14:00:00-04:00",
  "requested_end": "2026-05-03T15:30:00-04:00",
  "booking_type": "slot",
  "related_listing_id": "uuid",
  "related_listing_type": "mls",
  "client_note": "I'd love to see the backyard specifically."
}
```

**Request — suggesting a custom time:**
```json
{
  "appointment_type_id": "uuid",
  "requested_start": "2026-05-04T18:00:00-04:00",
  "requested_end": "2026-05-04T19:30:00-04:00",
  "booking_type": "suggestion",
  "client_note": "Evenings work better for me."
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "appointment_type": { "name": "Home Tour", "duration_minutes": 90 },
    "confirmed_start": "2026-05-03T14:00:00-04:00",
    "confirmed_end": "2026-05-03T15:30:00-04:00",
    "message": "Your appointment is confirmed! Check your email for details."
  },
  "error": null
}
```

**Notes:**
- `slot` bookings: validated against availability, status set to `confirmed` immediately (or `pending` if agent has auto-confirm disabled)
- `suggestion` bookings: status set to `suggested`, agent notified via push
- Confirmation email + calendar invite sent on creation

---

### GET `/api/v1/appointments`
List appointments.

**Auth:** `client` (own only) / `agent` (all)

**Query Params:**

| Param | Description |
|---|---|
| `status` | Filter by status (comma-separated) |
| `from` | ISO datetime — start of range |
| `to` | ISO datetime — end of range |
| `client_id` | Agent only — filter by client |

**Response:** Paginated array of appointment objects

---

### GET `/api/v1/appointments/:id`
**Auth:** `client` (own) / `agent`

**Response:** Full appointment object including client and appointment type details

---

### PATCH `/api/v1/appointments/:id/confirm`
Agent confirms a pending or suggested appointment.

**Auth:** `agent`

**Request:**
```json
{
  "agent_note": "See you then! Please bring your pre-approval letter.",
  "confirmed_start": "2026-05-03T14:00:00-04:00",
  "confirmed_end": "2026-05-03T15:30:00-04:00"
}
```

**Response:** Updated appointment object with `status: "confirmed"`

---

### PATCH `/api/v1/appointments/:id/counter`
Agent proposes a different time in response to a suggestion.

**Auth:** `agent`

**Request:**
```json
{
  "counter_start": "2026-05-05T10:00:00-04:00",
  "counter_end": "2026-05-05T11:30:00-04:00",
  "agent_note": "That evening doesn't work for me, but I'm free Saturday morning."
}
```

**Response:** Updated appointment object with `status: "counter_proposed"`

**Notes:**
- Client receives push notification + email with the counter-proposal
- Client can accept or decline via their portal

---

### PATCH `/api/v1/appointments/:id/accept-counter`
Client accepts the agent's counter-proposed time.

**Auth:** `client` (own appointment)

**Response:** Updated appointment with `status: "confirmed"`, `confirmed_start/end` set from `counter_start/end`

---

### PATCH `/api/v1/appointments/:id/cancel`
Cancel an appointment (agent or client).

**Auth:** `client` (own) / `agent`

**Request:**
```json
{
  "reason": "Change of plans — will reschedule."
}
```

**Response:** Updated appointment with `status: "cancelled_client"` or `"cancelled_agent"`

---

### PATCH `/api/v1/appointments/:id/complete`
Mark appointment as completed.

**Auth:** `agent`

**Response:** Updated appointment with `status: "completed"`

---

## 12. Documents

### GET `/api/v1/documents`
**Auth:** `public` (returns `is_public = true` only) / `agent` (returns all)

**Query Params:** `category`, `page`, `limit`

**Response:** Paginated array of document objects

---

### POST `/api/v1/documents`
Upload a document to the agent's library.

**Auth:** `agent`

**Request:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | File | yes |
| `name` | string | yes |
| `description` | string | no |
| `category` | string | yes |
| `is_public` | boolean | no (default false) |

**Response:** Created document object with `file_url`

---

### PATCH `/api/v1/documents/:id`
Update document metadata.

**Auth:** `agent`

**Request:** `name`, `description`, `category`, `is_public` (any subset)

**Response:** Updated document object

---

### DELETE `/api/v1/documents/:id`
**Auth:** `agent`

**Notes:** Also deletes file from storage. Checks for references in active message threads — warns agent if document is referenced but still deletes.

---

### GET `/api/v1/documents/:id/download`
Get a short-lived signed download URL.

**Auth:** `client` (for private docs, must be linked from a message thread) / `agent` / `public` (if `is_public = true`)

**Response:**
```json
{
  "data": {
    "url": "https://storage.supabase.co/object/sign/...",
    "expires_in_seconds": 3600,
    "file_name": "Buyer-Guide-2026.pdf"
  },
  "error": null
}
```

---

## 13. Blog

### GET `/api/v1/blog`
List published blog posts.

**Auth:** `public`

**Query Params:** `tags`, `page`, `limit`, `sort` (`published_at` default)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Columbia SC Market Update — April 2026",
      "slug": "columbia-sc-market-update-april-2026",
      "excerpt": "Inventory is tightening in the Midlands...",
      "cover_image_url": "https://...",
      "tags": ["Market Update", "Columbia SC"],
      "published_at": "2026-04-15T09:00:00Z"
    }
  ],
  "error": null,
  "meta": { "page": 1, "limit": 10, "total": 24 }
}
```

---

### GET `/api/v1/blog/:slug`
Get full post content by slug.

**Auth:** `public`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "title": "Columbia SC Market Update — April 2026",
    "slug": "columbia-sc-market-update-april-2026",
    "excerpt": "...",
    "content_html": "<h2>...</h2><p>...</p>",
    "cover_image_url": "https://...",
    "cover_image_alt": "Columbia SC skyline",
    "meta_title": "Columbia SC Market Update April 2026 | Kaptivating Homes",
    "meta_description": "...",
    "tags": ["Market Update", "Columbia SC"],
    "published_at": "2026-04-15T09:00:00Z"
  },
  "error": null
}
```

**Notes:** Returns `content_html` (pre-rendered) to the public — never the raw TipTap JSON

---

### GET `/api/v1/blog/admin`
List all posts including drafts.

**Auth:** `agent`

**Query Params:** `is_published` (`true`, `false`, or omit for all), `page`, `limit`

**Response:** Same shape as public list, plus `is_published`, `updated_at`

---

### POST `/api/v1/blog`
Create a new blog post.

**Auth:** `agent`

**Request:**
```json
{
  "title": "5 Tips for First-Time Buyers in SC",
  "content": { ...TipTap JSON... },
  "excerpt": "Buying your first home in South Carolina? Here's what you need to know.",
  "cover_image_url": "https://...",
  "cover_image_alt": "House with sold sign",
  "tags": ["Buyer Tips", "South Carolina"],
  "is_published": false
}
```

**Response:** Created post object

**Notes:**
- `slug` auto-generated from `title` (URL-safe, unique — suffixed with `-2` etc. if collision)
- Agent can override slug via PATCH after creation
- `content_html` rendered server-side from TipTap JSON on save
- `meta_title` and `meta_description` auto-populated from `title` and `excerpt` if not provided

---

### PATCH `/api/v1/blog/:id`
Update a post. Publishing a draft: set `is_published: true`.

**Auth:** `agent`

**Request:** Any subset of POST fields, plus:
```json
{
  "is_published": true,
  "slug": "5-tips-first-time-buyers-sc"
}
```

**Response:** Updated post object

---

### DELETE `/api/v1/blog/:id`
**Auth:** `agent`

**Response:** `{ "data": { "message": "Post deleted." }, "error": null }`

---

### POST `/api/v1/blog/upload-image`
Upload an image for use inside the TipTap editor.

**Auth:** `agent`

**Request:** `multipart/form-data` with `file` field (jpg, png, webp — max 5MB)

**Response:**
```json
{
  "data": { "url": "https://storage.supabase.co/object/public/blog-images/..." },
  "error": null
}
```

**Notes:** TipTap's image extension is configured to call this endpoint when agent drops/inserts an image

---

## 14. Saved Properties

### GET `/api/v1/me/saved-properties`
**Auth:** `client`

**Response:** Array of full listing objects (from `v_listings`) that the user has saved

---

### POST `/api/v1/me/saved-properties`
**Auth:** `client`

**Request:**
```json
{
  "listing_id": "uuid",
  "listing_type": "mls"
}
```

**Response:** Created saved property record

---

### DELETE `/api/v1/me/saved-properties/:id`
**Auth:** `client` (own record only)

**Response:** `{ "data": { "message": "Removed." }, "error": null }`

---

## 15. Saved Searches

### GET `/api/v1/me/saved-searches`
**Auth:** `client`

**Response:** Array of saved search objects with filter details

---

### POST `/api/v1/me/saved-searches`
**Auth:** `client`

**Request:**
```json
{
  "name": "3BR under $400k Columbia",
  "filters": {
    "states": ["SC"],
    "cities": ["Columbia", "Lexington"],
    "min_beds": 3,
    "max_price": 400000,
    "property_types": ["Single Family"]
  },
  "notify_on_new_match": true
}
```

**Response:** Created saved search object

---

### PATCH `/api/v1/me/saved-searches/:id`
**Auth:** `client` (own only)

**Request:** Any subset of `name`, `filters`, `notify_on_new_match`

**Response:** Updated saved search object

---

### DELETE `/api/v1/me/saved-searches/:id`
**Auth:** `client` (own only)

**Response:** `{ "data": { "message": "Saved search deleted." }, "error": null }`

---

## 16. Push Notifications

### POST `/api/v1/push/subscribe`
Register a browser push subscription.

**Auth:** `client`

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "p256dh_key": "BNcRdreALRFXTkOOUHK...",
  "auth_key": "tBHItJI5svbpez7KI4CCXg==",
  "user_agent": "Mozilla/5.0 ..."
}
```

**Response:** `{ "data": { "message": "Subscribed." }, "error": null }`

---

### DELETE `/api/v1/push/subscribe`
Unregister push subscription (e.g., user opts out or logs out).

**Auth:** `client`

**Request:**
```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

**Response:** `{ "data": { "message": "Unsubscribed." }, "error": null }`

---

## 17. Notifications

### GET `/api/v1/notifications`
Get the current user's notification history (in-app notification center).

**Auth:** `client`

**Query Params:** `unread_only` (`true`/`false`), `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "new_message",
      "title": "New message from Agent",
      "body": "Hi Jane, I wanted to follow up on 123 Oak Street...",
      "data": { "thread_id": "uuid" },
      "channel": "in_app",
      "status": "sent",
      "read_at": null,
      "created_at": "2026-04-29T14:35:00Z"
    }
  ],
  "error": null,
  "meta": { "page": 1, "limit": 20, "total": 7, "unread_count": 3 }
}
```

---

### PATCH `/api/v1/notifications/:id/read`
**Auth:** `client`

**Response:** `{ "data": { "read_at": "2026-04-29T15:00:00Z" }, "error": null }`

---

### POST `/api/v1/notifications/read-all`
Mark all unread notifications as read.

**Auth:** `client`

**Response:** `{ "data": { "marked_read": 3 }, "error": null }`

---

## 18. Dashboard & Leads

### GET `/api/v1/dashboard/stats`
Agent dashboard analytics overview.

**Auth:** `agent`

**Query Params:** `period` (`7d`, `30d`, `90d` — default `30d`)

**Response:**
```json
{
  "data": {
    "period": "30d",
    "leads": {
      "total": 42,
      "new_this_period": 12,
      "by_source": {
        "chat": 8,
        "contact_form": 6,
        "property_inquiry": 14,
        "booking": 14
      }
    },
    "messages": {
      "total_threads": 18,
      "unread_threads": 3,
      "avg_response_time_minutes": 22
    },
    "appointments": {
      "upcoming": 5,
      "completed_this_period": 9,
      "no_shows": 1
    },
    "listings": {
      "active_mls": 247,
      "active_manual": 3,
      "featured": 6,
      "most_viewed": [
        { "listing_id": "uuid", "address": "123 Oak St", "views": 84 }
      ]
    },
    "markets": [
      { "state": "SC", "mls_name": "CMLS", "last_synced_at": "2026-04-29T06:00:00Z", "active_listings": 247 }
    ]
  },
  "error": null
}
```

---

### GET `/api/v1/leads`
**Auth:** `agent`

**Query Params:** `tags` (comma-separated), `source`, `sort` (`last_active_at` default), `page`, `limit`

**Response:** Paginated array of lead objects including user details, tags, source, and last message preview

---

### GET `/api/v1/leads/:id`
**Auth:** `agent`

**Response:** Full lead profile including user details, tags, notes, appointment history, saved properties count, message thread link

---

### PATCH `/api/v1/leads/:id`
**Auth:** `agent`

**Request:**
```json
{
  "tags": ["Buyer", "Hot"],
  "agent_notes": "Pre-approved up to $450k. Wants to move by August."
}
```

**Response:** Updated lead object

---

## 19. Socket.io Event Map

The Socket.io server runs on the Node.js API server (not Vercel). Connections are authenticated via the Supabase JWT passed in the handshake `auth` object.

```javascript
// Client connection
const socket = io('wss://api.kaptivatinghomes.com', {
  auth: { token: supabaseAccessToken }
});
```

---

### Rooms

| Room name | Who joins | Purpose |
|---|---|---|
| `agent` | Agent only | Receives all agent-targeted events |
| `thread:{thread_id}` | Agent + thread's client | Scoped messaging events |
| `chat:{session_id}` | Agent + session's guest | Live chat events |
| `user:{user_id}` | That user only | Personal notifications |

---

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join_thread` | `{ thread_id }` | Join a thread room |
| `leave_thread` | `{ thread_id }` | Leave a thread room |
| `typing_start` | `{ thread_id }` | User started typing |
| `typing_stop` | `{ thread_id }` | User stopped typing |
| `join_chat` | `{ session_id }` | Agent joins a live chat |
| `chat_typing_start` | `{ session_id }` | Typing indicator in chat |
| `chat_typing_stop` | `{ session_id }` | Stopped typing in chat |

**Notes:** Sending messages is done via REST (`POST /threads/:id/messages`) — not Socket.io. Socket.io is used only for real-time delivery of events, not as the primary message transport. This ensures messages are always persisted to PostgreSQL regardless of connection state.

---

### Server → Client Events

| Event | Payload | Sent to |
|---|---|---|
| `new_message` | `{ message, thread_id }` | `thread:{thread_id}` room |
| `message_read` | `{ message_id, thread_id, read_at }` | `thread:{thread_id}` room |
| `typing` | `{ thread_id, sender_role }` | `thread:{thread_id}` room |
| `typing_stopped` | `{ thread_id, sender_role }` | `thread:{thread_id}` room |
| `new_chat_session` | `{ session }` | `agent` room |
| `chat_message` | `{ session_id, message }` | `chat:{session_id}` room |
| `agent_joined` | `{ session_id, agent_joined_at }` | `chat:{session_id}` room |
| `chat_closed` | `{ session_id }` | `chat:{session_id}` room |
| `notification` | `{ notification }` | `user:{user_id}` room |
| `appointment_update` | `{ appointment }` | `user:{user_id}` room |
| `sync_complete` | `{ market_id, new_listings, updated, removed }` | `agent` room |

---

### Connection & Reconnection

- Client should implement exponential backoff reconnection (Socket.io client does this by default)
- On reconnect, client should re-join all rooms it was previously in and re-fetch unread counts via REST
- Server does NOT replay missed events on reconnect — the client fetches current state from REST endpoints on reconnect

---

## 20. Error Reference

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad request — validation error |
| `401` | Unauthenticated — no or invalid JWT |
| `403` | Unauthorized — valid JWT but wrong role / not your resource |
| `404` | Not found |
| `409` | Conflict — e.g. duplicate saved property, duplicate slug |
| `422` | Unprocessable — business logic error (e.g. slot no longer available) |
| `429` | Rate limited |
| `500` | Server error |

### Error Codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request body failed validation (field-level errors in `data`) |
| `NOT_FOUND` | Resource does not exist |
| `UNAUTHORIZED` | Not your resource |
| `SLOT_UNAVAILABLE` | Requested appointment slot was taken between selection and submission |
| `MLS_SYNC_FAILED` | IDX provider returned an error during sync |
| `DUPLICATE` | Unique constraint would be violated |
| `FILE_TOO_LARGE` | Upload exceeds size limit |
| `INVALID_FILE_TYPE` | Unsupported file format |
| `MAGIC_LINK_EXPIRED` | Login link has expired (Supabase handles this, but surfaced here) |

### Validation Error Shape

```json
{
  "data": {
    "fields": {
      "email": "Must be a valid email address.",
      "price": "Must be a positive number."
    }
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  }
}
```

---

*Last updated: 2026-04-29*
*Plan maintained by: GeekReign-76*
