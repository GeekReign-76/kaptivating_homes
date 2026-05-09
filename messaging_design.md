# Messaging System — Architecture & Design

**Last updated:** 2026-04-29

---

## Table of Contents

1. [Overview](#1-overview)
2. [Two-Channel Design: REST + Socket.io](#2-two-channel-design-rest--socketio)
3. [Rooms & Authentication](#3-rooms--authentication)
4. [Thread Lifecycle](#4-thread-lifecycle)
5. [Message Types](#5-message-types)
6. [Delivery Guarantees](#6-delivery-guarantees)
7. [Live Chat vs Messaging](#7-live-chat-vs-messaging)
8. [Live Chat Session Lifecycle](#8-live-chat-session-lifecycle)
9. [Read Receipts & Unread Counts](#9-read-receipts--unread-counts)
10. [Typing Indicators](#10-typing-indicators)
11. [Property Card Rendering](#11-property-card-rendering)
12. [File Structure](#12-file-structure)

---

## 1. Overview

The messaging system has two distinct communication modes:

| Mode | Who | Requires account | Persistent |
|---|---|---|---|
| **Messaging** | Registered client ↔ Agent | Yes | Yes — full history |
| **Live Chat** | Guest ↔ Agent | No — name + email only | Session only (convertible) |

Both share the same Socket.io server. Registered users get persistent threads; guests get ephemeral chat sessions that can be converted into threads when they register.

---

## 2. Two-Channel Design: REST + Socket.io

**Rule: REST for persistence, Socket.io for delivery.**

```
Client A                     Server                      Client B
   │                            │                            │
   │── POST /threads/:id/msgs ──►│                            │
   │                            │── INSERT to DB ────────────│
   │                            │── emit 'new_message' ──────►│  (if online)
   │                            │── queue push notif ────────│  (if offline)
   │◄── 201 { message } ────────│                            │
```

**Why not send messages over Socket.io directly?**
- If the WebSocket connection drops mid-send, the message is lost
- The REST endpoint guarantees the message hits PostgreSQL before returning 201
- Socket.io is purely a delivery mechanism — it reads from the DB record already created
- On reconnect, client calls `GET /threads/:id/messages?before={last_seen}` to catch up — no replay logic needed in Socket.io

---

## 3. Rooms & Authentication

### Socket.io Authentication

JWT passed in the handshake `auth` object, validated against Supabase on every connection.

```javascript
// Client
const socket = io('wss://api.kaptivatinghomes.com', {
  auth: { token: supabaseAccessToken }
});

// Server — middleware validates before accepting connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return next(new Error('UNAUTHORIZED'));
  socket.data.userId = user.id;
  socket.data.role   = await getUserRole(user.id);
  next();
});
```

### Room Structure

| Room | Joined by | Purpose |
|---|---|---|
| `agent` | Agent only (auto on connect) | New chat alerts, dashboard-wide events, sync notifications |
| `thread:{thread_id}` | Agent + thread's client | Scoped message events for one conversation |
| `chat:{session_id}` | Agent + session's guest | Live chat session events |
| `user:{user_id}` | That user only (auto on connect) | Personal notifications (appointments, listing matches) |

**Auto-join on connection:**
```
Agent connects   → joins 'agent', joins 'user:{agentId}'
Client connects  → joins 'user:{clientId}'
                   does NOT auto-join thread rooms
                   (joins explicitly via join_thread event)
```

Clients join thread rooms lazily — only when they open a conversation. This prevents receiving stale events for old threads that aren't in view.

---

## 4. Thread Lifecycle

### Creation

A thread is created in one of three ways:

| Trigger | Who | Endpoint |
|---|---|---|
| Client clicks "Ask about this property" | Client | `POST /api/v1/threads` with `related_listing_id` |
| Client submits contact form | Client | `POST /api/v1/threads` with `initial_message` |
| Agent starts outreach | Agent | `POST /api/v1/threads` with `client_id` |
| Chat session converted | System | `POST /api/v1/chat/sessions/:id/convert` |

**Deduplication:** Before creating, check if a thread already exists for this `(client_id)` — or for `(client_id, related_listing_id)` if a listing is involved. Return the existing thread instead of creating a duplicate.

### Subject line
Auto-generated as `"Re: {address}, {city}, {state}"` for property-linked threads.
For general threads: `"Message from {client name}"`.
Agent can override the subject from the dashboard.

### Thread is never deleted
Threads are permanent. Status-changing events (appointment confirmed, listing sold) are injected as `system` messages in the thread. This keeps the full conversation history intact.

---

## 5. Message Types

```typescript
type MessageType = 'text' | 'property_card' | 'pdf' | 'image' | 'system';
```

### `text`
Plain message body. Supports basic markdown (bold, italic, line breaks).
```json
{
  "message_type": "text",
  "content": "Hi! I'm available Saturday at 2pm for a showing.",
  "metadata": {}
}
```

### `property_card`
Agent shares a listing. Resolved server-side — client sends the listing ID, server builds the card data before storing.
```json
{
  "message_type": "property_card",
  "content": null,
  "metadata": {
    "listing_id":     "uuid",
    "listing_type":   "mls",
    "address":        "123 Oak St",
    "city":           "Columbia",
    "state":          "SC",
    "price":          349000,
    "beds":           4,
    "baths":          2.5,
    "photo_url":      "https://...",
    "listing_url":    "/listings/uuid"
  }
}
```
The frontend renders this as a clickable property mini-card inside the thread.

### `pdf`
Agent shares a document from their library. Signed URL generated fresh at read time (not stored in message).
```json
{
  "message_type": "pdf",
  "content": null,
  "metadata": {
    "document_id":  "uuid",
    "file_name":    "Buyer-Guide-2026.pdf",
    "file_size_bytes": 840293
  }
}
```

### `image`
Photo attachment uploaded directly.
```json
{
  "message_type": "image",
  "content": null,
  "metadata": {
    "file_url":  "https://storage.supabase.co/...",
    "file_name": "property-photo.jpg",
    "width":     1920,
    "height":    1080
  }
}
```

### `system`
Automated event record — never sent by a user. Used for:
- "Appointment confirmed for May 3rd at 2:00 PM"
- "Home Tour rescheduled to May 5th at 10:00 AM"
- "This listing is now under contract"

Rendered differently in the UI (centered, grey, no avatar).
```json
{
  "message_type": "system",
  "content": "Appointment confirmed — Home Tour on May 3rd at 2:00 PM ET",
  "sender_role": "system",
  "metadata": {
    "event_type":     "appointment_confirmed",
    "appointment_id": "uuid"
  }
}
```

---

## 6. Delivery Guarantees

### Online recipient
1. Client sends `POST /threads/:id/messages` → 201 response (DB written)
2. Server emits `new_message` to `thread:{thread_id}` room
3. Recipient receives event instantly via Socket.io
4. No push notification queued (recipient is online)

### Offline recipient
1. `POST /threads/:id/messages` → 201 response (DB written)
2. Server attempts `io.to('thread:{id}').emit(...)` — no connected clients → emits to empty room, noop
3. Push notification queued in BullMQ
4. Worker sends push → device shows OS notification
5. User taps → opens thread URL → client fetches messages via REST

### Reconnection
On reconnect, the Socket.io client re-emits `join_thread` for every open conversation. The server does **not** replay missed events. The frontend calls `GET /threads/:id/messages?before={last_seen_id}` to load any messages received while offline. This is simpler and more reliable than event replay.

### Duplicate prevention
The server checks `socket.rooms.has('thread:' + threadId)` before joining — safe to call `join_thread` multiple times. Messages have a DB-generated UUID — no client-side ID generation that could duplicate.

---

## 7. Live Chat vs Messaging

| Feature | Live Chat | Messaging |
|---|---|---|
| Account required | No | Yes |
| Persisted | Session only | Permanent |
| History | Lost on close (unless converted) | Full history forever |
| Message types | Text only | All types |
| Initiator | Guest | Client or Agent |
| Agent status shown | Yes (online/away/offline) | No |
| Typing indicators | Yes | Yes |
| Read receipts | No | Yes |

### Chat → Thread conversion
When agent converts a chat session to a thread:
1. Guest email already captured → look up or create `users` record
2. Create `threads` row linked to the user
3. Import chat messages as `text` messages into the thread (preserve order)
4. Send guest a magic link email: "Continue your conversation — click to register and access your messages"
5. Set `chat_sessions.status = 'converted'`, `converted_thread_id = thread.id`
6. Emit `chat_closed` Socket.io event to the chat room

---

## 8. Live Chat Session Lifecycle

```
Guest opens chat widget
        │
        ▼
POST /chat/sessions { guest_name, guest_email, initial_message }
        │
        ▼
status: 'waiting'
Socket.io emits 'new_chat_session' to 'agent' room
        │
  ┌─────┴──────────────────────────────────────────────────┐
  │                                                        │
  ▼                                                        ▼
Agent online                                        Agent offline
(joins session)                                  (auto-response sent,
  │                                               captured as lead)
  ▼
POST /chat/sessions/:id/join
status: 'active'
Socket.io emits 'agent_joined' to 'chat:{id}' room
  │
  ├── Real-time messages exchanged via Socket.io chat events
  │   (also written to chat_messages table)
  │
  ├── Agent may request name/email mid-chat if not captured
  │
  └── Session ends
       │
       ├── PATCH /chat/sessions/:id/close → status: 'closed'
       │
       └── POST /chat/sessions/:id/convert → status: 'converted'
             Guest gets magic link email
             All chat messages imported to thread
```

### Agent availability status
Derived in real-time from Socket.io:
- `online` = agent has an active Socket.io connection (connected to `agent` room)
- `away` = agent set a manual away status in dashboard
- `offline` = no Socket.io connection

The chat widget polls `GET /api/v1/chat/agent-status` (lightweight, cached 30 seconds) to show the status indicator before a session is started.

---

## 9. Read Receipts & Unread Counts

### Unread count strategy
The `threads` table has denormalized `agent_unread_count` and `client_unread_count` columns. These are:
- **Incremented** when a message is inserted for the other party
- **Reset to 0** when the recipient calls `POST /threads/:id/read-all`

This makes inbox badge rendering fast (just read the count column — no COUNT query on messages).

### Message-level read receipts
`messages.read_at` is set when:
- Recipient calls `PATCH /messages/:id/read`, or
- Recipient calls `POST /threads/:id/read-all` (bulk mark)

`read_at` drives the double-checkmark indicator in the thread view.

### Socket.io read event
When agent or client marks messages read, emit `message_read` to the thread room so the sender sees the checkmark update in real-time without a page refresh.

---

## 10. Typing Indicators

Server receives `typing_start` → broadcasts `typing` to room.
Client-side: emit `typing_start` on first keystroke, then debounce `typing_stop` 2 seconds after last keystroke.

```
Client A types...
  │── typing_start { thread_id } ──► Server ──► Client B: { typing: true, sender_role: 'client' }
  │  (2 seconds of silence)
  │── typing_stop { thread_id } ───► Server ──► Client B: { typing: false, sender_role: 'client' }
```

**Server does not persist typing state.** If the server restarts, typing indicators just stop — no stale "X is typing" state stuck forever.

**Typing indicators are NOT queued.** They're fire-and-forget over Socket.io only. If the recipient is offline, they simply don't see them — that's correct behavior.

---

## 11. Property Card Rendering

When agent sends a property card:
1. Agent selects a listing from a search box in the message composer
2. Frontend sends `{ message_type: 'property_card', metadata: { listing_id, listing_type } }`
3. Server resolves the listing from `v_listings` view and stores rich metadata in `messages.metadata`
4. Stored metadata includes: address, city, price, beds, baths, photo_url, listing_url
5. Frontend renders a clickable card — no additional API call needed to display it
6. If the listing later goes sold/withdrawn, the card still shows (historical snapshot)

This snapshot approach means the card always renders correctly regardless of future MLS status changes.

---

## 12. File Structure

```
backend/src/
├── server.ts                    Express + Socket.io server, exports getIO()
├── socket/
│   ├── socketServer.ts          Socket.io setup, auth middleware, room management
│   ├── threadSocket.ts          Thread room event handlers (join, typing, read)
│   └── chatSocket.ts            Live chat event handlers
├── services/
│   ├── threadService.ts         Thread CRUD, inbox, deduplication, conversion
│   ├── messageService.ts        Message creation, read receipts, property card resolution
│   └── chatService.ts           Live chat session management
└── routes/
    ├── threads.ts               Thread + message REST endpoints
    └── chat.ts                  Chat session REST endpoints
```
