# Kaptivating Homes — Real Estate Platform Build Plan

**Client:** Real Estate Agent (SC licensed, expanding to GA + FL)
**Project Start:** 2026
**Status:** In Progress — Schema & Architecture Design

---

## Confirmed Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Client account required to book appointments | Yes — forced registration |
| 2 | Client account required to message agent | Yes — forced registration |
| 3 | Saved searches for guests | No — registered clients only. Guests shown a prompt explaining expanded features available after sign-up |
| 4 | Blog editor | TipTap WYSIWYG (user-friendly toolbar, no coding required) |
| 5 | MLS vs manual listing display | Identical to visitors. Manual (off-MLS) listings can be starred by agent for visual emphasis |
| 6 | Launch state | SC only. Multi-state infrastructure built from day one — GA and FL added via config, not code |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [MLS & IDX Integration](#5-mls--idx-integration)
6. [Public Website](#6-public-website)
7. [Agent Dashboard](#7-agent-dashboard)
8. [Internal Messaging Service](#8-internal-messaging-service)
9. [Live Chat](#9-live-chat)
10. [Calendar & Booking System](#10-calendar--booking-system)
11. [User Roles & Auth](#11-user-roles--auth)
12. [Database Schema](#12-database-schema)
13. [API Design](#13-api-design)
14. [Push Notification Architecture](#14-push-notification-architecture)
15. [File Storage & PDF Sharing](#15-file-storage--pdf-sharing)
16. [Phase Build Plan](#16-phase-build-plan)
17. [Pre-Build Dependencies (Client Action Items)](#17-pre-build-dependencies-client-action-items)
18. [Open Questions & Decisions](#18-open-questions--decisions)

---

## 1. Project Overview

A fully custom-branded real estate platform for an agent currently licensed in South Carolina, with infrastructure designed from day one to support expansion into Georgia and Florida without a rebuild.

**Core goals:**
- Unique, non-template website that reflects the agent's personal brand
- Unified property search pulling from multiple MLS sources across states
- Direct agent-to-client communication with push notifications
- Shareable property links and PDF documents
- Agent-controlled dashboard for managing listings, leads, content, and availability
- Live chat for immediate engagement with site visitors
- Calendar system for scheduling tours and consultations

---

## 2. Architecture Philosophy

### Multi-State Ready from Day One

Even though we launch with SC only, the data layer and API design treat **state** as a first-class concept from the start.

- Every listing object carries `mls_source`, `state`, and `region` fields
- The IDX connection is abstracted behind a `ListingProvider` interface — adding a new state = adding a new provider config, not new code
- Search filters always include state as a parameter even when only one is active
- Admin dashboard has a "Markets" section where new states are toggled on when ready
- Database schema supports multiple MLS sources without migration changes

### Separation of Concerns

- **Next.js** handles the public-facing site and SEO
- **Node.js API server** handles business logic, MLS sync, messaging, and real-time features
- **Supabase** handles auth, database, and file storage
- **Socket.io** runs on the API server (not Vercel — Vercel does not support persistent WebSocket connections)

---

## 3. Tech Stack

### Frontend
| Tool | Purpose |
|---|---|
| Next.js 14+ (App Router) | Public site + agent dashboard, SSR for SEO |
| Tailwind CSS | Custom styling, no templates |
| shadcn/ui | Accessible, customizable component primitives |
| Mapbox GL JS | Interactive property map with multi-state pins |
| Socket.io client | Real-time messaging and live chat |
| Firebase Cloud Messaging (FCM) | Web push notifications |
| React Big Calendar | Calendar UI for booking interface |

### Backend
| Tool | Purpose |
|---|---|
| Node.js + Express | Core API server |
| Socket.io | WebSocket server for real-time chat and messaging |
| BullMQ | Job queue for MLS sync, notifications, PDF generation |
| PostgreSQL (Supabase) | Primary database |
| Redis (Upstash) | MLS listing cache, session store, notification queue |

### Infrastructure
| Tool | Purpose |
|---|---|
| Vercel | Next.js frontend hosting |
| Railway or Render | Node.js API + Socket.io server |
| Supabase | PostgreSQL + Auth + File Storage |
| Upstash | Serverless Redis |
| AWS S3 or Supabase Storage | PDFs, documents, uploaded photos |
| Firebase | Push notification delivery |
| Twilio SendGrid | Email (confirmations, fallback notifications) |

### MLS / IDX
| Option | Notes |
|---|---|
| Bridge Interactive | Zillow-owned aggregator, multi-MLS, RESO Web API |
| Spark API | Alternative aggregator, strong RESO support |
| **Decision needed** | Select vendor before build starts |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────┐
│                 Next.js Frontend                 │
│      Public Site | Agent Dashboard | Portal      │
└──────────────────────┬──────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────┐
│              Node.js API Server                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Listings  │  │ Messaging  │  │  Calendar  │ │
│  │  Service   │  │  Service   │  │  Service   │ │
│  └────────────┘  └────────────┘  └────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │    Auth    │  │    Push    │  │    PDF     │ │
│  │  Service   │  │   Notif.   │  │  Service   │ │
│  └────────────┘  └────────────┘  └────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
    PostgreSQL        Redis        S3/Storage
    (Supabase)      (Upstash)     (Docs/PDFs)
         │
┌────────▼──────────────────┐
│      IDX Provider(s)       │
│  SC: CMLS      [ACTIVE]    │
│  GA: FMLS      [FUTURE]    │
│  FL: Stellar   [FUTURE]    │
└────────────────────────────┘
```

---

## 5. MLS & IDX Integration

### Overview

Each state has its own MLS organizations. Agents must hold membership in each MLS they want to pull listings from. An IDX agreement must be signed before any listings can be displayed.

**State → MLS mapping:**
| State | Primary MLS(es) | Status |
|---|---|---|
| SC | Consolidated MLS (CMLS) | Launch target |
| GA | FMLS, GAMLS | Phase 2 |
| FL | Stellar MLS, BeachesMLS, MIAMI MLS | Phase 2/3 |

### IDX Aggregator Approach

Rather than building direct RESO/RETS connections to each MLS individually, we use an IDX aggregator. The aggregator:
- Normalizes data across all connected MLSs into a consistent schema
- Handles IDX compliance labeling (attribution, copyright, MLS logos)
- Provides a single REST/RESO Web API endpoint for all data
- Manages data refresh cadence per MLS rules (typically every 12–24 hours)

### ListingProvider Abstraction

```
ListingProviderInterface
  ├── fetchListings(filters)
  ├── fetchListingById(id)
  ├── fetchListingPhotos(id)
  └── getLastSyncedAt()

SCListingProvider (implements ListingProviderInterface)
  └── connects to: Bridge Interactive / CMLS feed

GAListingProvider (implements ListingProviderInterface)  ← add later
  └── connects to: Bridge Interactive / FMLS + GAMLS feeds

FLListingProvider (implements ListingProviderInterface)  ← add later
  └── connects to: Bridge Interactive / Stellar + Beaches feeds
```

When a new state is onboarded: create a new provider class, add it to the provider registry, enable in admin dashboard. No other code changes required.

### Sync Job (BullMQ)

- Runs every 12 hours per active provider
- Fetches all active listings, upserts into PostgreSQL
- Caches hot listings (recently viewed, featured) in Redis
- Marks expired/sold listings, triggers email alerts to any saved searches

### IDX Compliance Rules (Non-Negotiable)

Every listing display must include:
- MLS logo
- "Courtesy of [Listing Agent / Brokerage]" attribution
- Last updated timestamp
- Fair display (cannot suppress competitor listings)
- Data cannot be altered (agent can add display overrides on top, not modify source data)

---

## 6. Public Website

### Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, featured listings, agent bio, market areas |
| `/search` | Full property search with filters and map |
| `/listings/[id]` | Property detail page |
| `/buy` | Buyer resources landing page |
| `/sell` | Seller resources landing page |
| `/about` | Agent bio, credentials, testimonials |
| `/blog` | Market updates and articles |
| `/blog/[slug]` | Individual blog post |
| `/contact` | Contact form + booking CTA |
| `/book` | Calendar booking page |
| `/portal` | Registered client login / dashboard |

### Property Search

- Filters: state (multi-select, shows only active states), city, zip, price range, beds, baths, property type, square footage, lot size, year built, keywords
- Results: grid view and map view toggle
- Map: Mapbox GL — pins grouped by state color, click pin opens mini property card with link to detail
- Sort: price, newest, most recently updated
- Pagination + infinite scroll option

### Property Detail Page

- Full photo gallery (lightbox)
- Property details table (all MLS fields)
- Map embed (property location)
- IDX compliance block (required attribution)
- Mortgage calculator widget
- "Schedule a Showing" CTA → calendar booking
- "Ask About This Property" CTA → opens chat thread pre-tagged to this listing
- Share button (link + PDF download of property details)
- Similar properties carousel

---

## 7. Agent Dashboard

### Access
- Agent-only role, email + password auth
- Available as a PWA (Progressive Web App) for mobile push notifications without an app store

### Sections

#### Listings Management
- View all active MLS listings in a sortable table
- Toggle "Featured" to pin listings to the homepage carousel
- Add display-layer overrides (custom headline, highlight tags: "Price Reduced", "Just Listed", "Hot Deal") — stored separately from MLS source data
- Upload additional photos or documents to supplement MLS data
- Manually add off-MLS listings (pocket listings, pre-market, rentals)
- Manually inactivate a listing from display (override MLS active status)

#### Lead Management
- All leads in a sortable/filterable table
- Lead detail: name, contact info, source, properties viewed, messages sent
- Tags: Buyer, Seller, Hot, Nurture, Closed, Archived
- Quick-reply button that opens messaging thread

#### Inbox (Messaging)
- All message threads, sorted by unread/recency
- Unread count badge
- Thread view with full message history
- Compose: text, property link card, PDF share, image
- See if client has read the message (read receipts)

#### Live Chat Queue
- Real-time incoming chat notifications
- Accept / dismiss chat requests
- If away: configure auto-response message
- Chat history saved and linked to lead profile

#### Calendar & Appointments
- Weekly/monthly calendar view
- Set availability windows
- View upcoming appointments
- Accept / decline / counter-propose suggested times from clients
- Cancel with optional message to client

#### Content Management
- Edit homepage hero text and CTA
- Update bio, headshot, credentials
- Manage testimonials (add/edit/delete/reorder)
- Upload and manage document library (buyer guides, seller guides, market reports)
- Publish/edit blog posts (rich text editor)
- Set featured market areas with descriptions and photos

#### Markets (Multi-State Management)
- View active MLS connections
- See last sync timestamp per provider
- Enable/disable states (when GA or FL is ready)
- View sync logs and error reports

#### Analytics
- Site traffic (page views, unique visitors)
- Most-viewed listings
- Lead source breakdown
- Upcoming appointments count
- Message response time average

---

## 8. Internal Messaging Service

### User Flow

1. Visitor fills out lead capture form or initiates chat → registered as a guest lead
2. Agent or client can start a thread at any time
3. Both parties get push notification (web push or email fallback) on new messages
4. Thread persists indefinitely — full history always accessible

### Message Types

| Type | Description |
|---|---|
| Text | Plain text message |
| Property Card | Agent pastes MLS ID or URL → renders rich property card inline |
| PDF Share | Agent selects from document library or uploads new file |
| Image | Photo attachment |
| System Message | Booking confirmation, appointment reminder, status updates |

### Real-Time Delivery

- Socket.io connection maintained while dashboard or portal is open
- Message stored in PostgreSQL immediately (source of truth)
- Delivered via WebSocket if recipient is connected
- If offline: queued in BullMQ, delivered via push notification + email

### Read Receipts

- Message marked `read_at` timestamp when recipient opens the thread
- Agent sees checkmark indicators in dashboard

---

## 9. Live Chat

### Widget Behavior

- Floating chat bubble on all public pages
- Shows agent photo, name, and status (online / away / offline)
- **If agent is online:** real-time Socket.io chat, typing indicators, read receipts
- **If agent is offline:** message captured as new lead thread, client gets "We'll get back to you shortly" confirmation, agent gets push notification

### Features

- Typing indicators
- Read receipts
- Agent can request client email/name mid-chat
- Agent can convert chat to a full registered-user thread
- Agent can share a property link or PDF directly in chat
- Pre-set quick replies for agent (configurable in dashboard)
- Chat history saved to lead profile

### Offline Auto-Response

Configurable message in dashboard: "Hi! I'm not available right now but I'll respond within [X hours]. Leave your name and email and I'll reach out soon."

---

## 10. Calendar & Booking System

### Agent Setup (Dashboard)

- Set weekly availability by day and time window
- Block specific dates / date ranges (vacation, holidays)
- Define appointment types:

| Type | Default Duration |
|---|---|
| Home Tour | 90 min |
| Buyer Consultation | 60 min |
| Seller Consultation | 60 min |
| Phone Call | 30 min |

- Set buffer time between appointments (e.g., 15 min)
- Set max appointments per day
- Toggle whether clients can suggest custom times

### Client Booking Flow

1. Client clicks "Schedule a Showing" or "Book a Consultation"
2. Selects appointment type
3. Views available time slots on calendar (agent's availability minus booked slots)
4. Selects slot → confirms name, email, phone, optional note
5. **OR:** Clicks "Suggest a different time" → picks any date/time → submits request

### Suggested Time Flow

1. Client submits a suggested time
2. Agent receives push notification: "New time suggestion from [Client Name]"
3. Agent reviews in dashboard → Accept / Counter-propose / Decline
4. If counter-proposed: client gets notification with new time offer, can Accept or Decline
5. Final confirmation sent to both parties via email + push

### Confirmations & Reminders

- Immediate confirmation email to both parties on booking
- iCal / Google Calendar link in confirmation email
- Push notification reminder 24 hours before appointment
- Push notification reminder 1 hour before appointment
- Agent can add a note to the reminder (e.g., "Please bring your pre-approval letter")

### Cancellation & Rescheduling

- Client or agent can cancel from confirmation email link or portal/dashboard
- Optional cancellation message
- Reschedule link redirects to booking flow with prior appointment pre-filled

---

## 11. User Roles & Auth

| Role | Auth Method | Access |
|---|---|---|
| **Agent (Admin)** | Email + password | Full dashboard, all features |
| **Registered Client** | Magic link (email) or Google OAuth | Messaging threads, saved properties, booking, document access |
| **Guest / Lead** | Name + email captured on form or chat | Public search, property views, chat, booking request (limited) |

**Auth provider:** Supabase Auth

- Magic link removes password friction for clients (one-click login from email)
- Session tokens stored in HTTP-only cookies
- Row-level security (RLS) on Supabase ensures users only see their own data

---

## 12. Database Schema

> **Status: Complete** — Full schema in [`database_schema.sql`](./database_schema.sql)

### Tables Summary

| Table | Purpose |
|---|---|
| `markets` | One row per MLS source. Seed SC at launch; add GA/FL via INSERT |
| `listings` | MLS listings cached from IDX feed — never modified by app code |
| `listing_overrides` | Agent display customizations layered on top of MLS data |
| `manual_listings` | Off-MLS pocket listings, fully agent-managed, `is_starred` option |
| `users` | All users (agent + clients). ID matches Supabase `auth.users.id` |
| `leads` | Enriched profile on top of users — source, tags, agent notes |
| `saved_properties` | Registered clients only — supports both MLS and manual listings |
| `saved_searches` | Registered clients only — filters JSONB, optional email alerts |
| `threads` | Messaging thread between agent and one client |
| `messages` | Individual messages — types: text, property_card, pdf, image, system |
| `chat_sessions` | Transient live chat for guests before registration |
| `chat_messages` | Messages within a live chat session |
| `appointment_types` | Home Tour, Buyer Consult, Seller Consult, Phone Call |
| `availability_windows` | Agent's weekly recurring availability |
| `availability_blocks` | One-off blocked dates / time ranges |
| `appointments` | Bookings with full status workflow (pending → confirmed → completed) |
| `documents` | Agent document library (PDFs, guides, reports) |
| `blog_posts` | Blog — content stored as TipTap JSON + pre-rendered HTML |
| `push_subscriptions` | Web Push API subscription tokens per user |
| `notifications` | All outbound notifications log with delivery status |
| `sync_logs` | Every sync run logged with stats, status, and error details |

### Key Design Decisions in Schema

- **MLS data is immutable** — `listings` table only written by the sync job. Agent customizations live in `listing_overrides` and are merged at query time via `v_listings` view.
- **`v_listings` unified view** — single query surface for the API that merges MLS listings + overrides + manual listings into one consistent shape. The frontend never needs to know the source.
- **Multi-state by default** — every listing-related table has a `state CHAR(2)` field. Adding GA requires one INSERT into `markets` and one new `ListingProvider` class.
- **`is_starred` on manual listings** — agent-toggled visual badge on listing cards for non-MLS properties.
- **Blog uses TipTap JSON** — stored as `content JSONB`, pre-rendered to `content_html TEXT` on save. Fast display, portable format, no vendor lock-in.
- **Appointment status state machine** — `pending → confirmed`, `suggested → counter_proposed → confirmed`, and cancellation/completion branches all captured in one `status` field with CHECK constraint.
- **RLS on every table** — Supabase Row Level Security enforced at the database layer. Clients can only see their own data. `is_agent()` helper function gates agent-level access.

---

## 13. API Design

> **Status: Complete** — Full API design in [`api_design.md`](./api_design.md)

### Endpoint Groups Summary

| Group | Endpoints | Auth |
|---|---|---|
| Auth | magic-link, login, logout, me, update profile | public / client |
| Listings (MLS) | search, featured, detail, similar, PDF, sync | public / agent |
| Listing Overrides | get, upsert, delete | agent |
| Manual Listings | CRUD, toggle star, toggle featured, PDF | public / agent |
| Markets | list, toggle active | public / agent |
| Threads | list, create, detail, messages, read-all | client / agent |
| Messages | send, mark read | client / agent |
| Live Chat | create session, join, send, close, convert to thread | public / agent |
| Availability | get slots, get/set windows, blocks | public / agent |
| Appointments | book, suggest, list, confirm, counter, accept-counter, cancel, complete | client / agent |
| Documents | list, upload, update, delete, signed download URL | public / agent |
| Blog | list published, get by slug, admin CRUD, image upload | public / agent |
| Saved Properties | list, add, remove | client |
| Saved Searches | list, create, update, delete | client |
| Push Subscriptions | subscribe, unsubscribe | client |
| Notifications | list, mark read, mark all read | client |
| Dashboard & Leads | stats, lead list, lead detail, update lead | agent |

### Key Design Principles

- **Unified listing endpoint** — `GET /api/v1/listings` queries the `v_listings` view and returns MLS + manual listings in the same shape. Frontend is source-agnostic.
- **REST for persistence, Socket.io for delivery** — messages are sent via REST (always persisted), Socket.io pushes real-time events to connected clients. Reconnect = re-fetch from REST.
- **Standard response envelope** — every response has `{ data, error, meta }` shape. `meta` only on paginated responses.
- **Slot validation at booking time** — availability slots are re-validated server-side on appointment creation. `SLOT_UNAVAILABLE` error returned if taken between selection and submit.

---

## 14. Push Notification Architecture

> **Status: Draft**

**Stack:** Firebase Cloud Messaging (FCM) for web push + email fallback via SendGrid

### Notification Events

| Event | Recipient | Channel |
|---|---|---|
| New message received | Agent + Client | Push + Email fallback |
| New chat initiated | Agent | Push |
| New appointment booking | Agent | Push + Email |
| Appointment reminder 24h | Agent + Client | Push + Email |
| Appointment reminder 1h | Agent + Client | Push |
| Appointment confirmed / cancelled | Client | Push + Email |
| New time suggestion | Agent | Push |
| Time suggestion response | Client | Push + Email |
| New listing matches saved search | Client | Push + Email |

### PWA for Agent Dashboard

- Service worker registered on dashboard
- Enables push notifications in browser without native app
- "Add to Home Screen" prompt allows agent to use dashboard as mobile app
- Push notifications delivered even when dashboard tab is closed

---

## 15. File Storage & PDF Sharing

**Storage:** Supabase Storage (S3-compatible) or AWS S3

### Document Library (Agent)

- Agent uploads PDFs from dashboard (buyer guide, seller guide, market reports, disclosures)
- Files stored in Supabase Storage with signed URLs
- Categories: Buyer Resources, Seller Resources, Market Reports, Property Documents, Other

### Property PDF Generation

- Any listing can be exported as a branded PDF
- PDF includes: property photos, key details, agent contact info, IDX attribution
- Generated server-side using Puppeteer or a PDF library (e.g., `pdfkit`, `@react-pdf/renderer`)
- Cached in storage after first generation, invalidated on listing update
- Shareable link generated (signed URL with optional expiry)

### Sharing in Messaging

- Agent selects "Share Property PDF" in a message thread
- System checks if cached PDF exists → generates if not → attaches signed URL
- Client receives message with download button
- Link can also be copied and shared externally (email, text, etc.)

---

## 16. Phase Build Plan

| Phase | Deliverables | Est. Duration |
|---|---|---|
| **0 — Setup** | Repo, infra provisioning, Supabase schema, IDX vendor onboarding, CI/CD | Week 1–2 |
| **1 — Public Site** | Homepage, property search + map, listing detail pages, lead capture forms | Weeks 3–6 |
| **2 — Agent Dashboard** | Listings management, overrides, manual listings, content management, analytics | Weeks 7–9 |
| **3 — Messaging + Chat** | Internal messaging, live chat widget, push notifications, PDF/link sharing | Weeks 10–12 |
| **4 — Calendar** | Booking system, availability management, client booking flow, suggest-a-time, reminders | Weeks 13–14 |
| **5 — QA + Launch** | End-to-end testing, IDX compliance audit, performance tuning, go live | Weeks 15–16 |
| **Post-Launch GA** | GA MLS (FMLS/GAMLS) provider + IDX agreement | TBD |
| **Post-Launch FL** | FL MLS (Stellar/Beaches) provider + IDX agreement | TBD |
| **Mobile** | React Native app (Expo) for iOS + Android | Separate engagement |

---

## 17. Pre-Build Dependencies (Client Action Items)

| Item | Owner | Blocking |
|---|---|---|
| SC MLS IDX agreement signed | Client | MLS listings cannot display without this |
| IDX aggregator selected and account created | Client + Dev | Needed before Phase 1 |
| Branding assets (logo, colors, fonts) | Client | Needed before Phase 1 |
| Domain name registered | Client | Needed for Phase 0 |
| Google account (for FCM + Calendar sync) | Client | Needed for Phase 3 |
| GA MLS membership application started | Client | Needed before GA expansion |
| FL MLS membership application started | Client | Needed before FL expansion |

---

## 18. Open Questions & Decisions

- [ ] IDX aggregator selection: Bridge Interactive vs Spark API — need to compare pricing and SC MLS coverage
- [ ] Calendar: Cal.com (self-hosted) vs custom build — Cal.com saves time but has some branding limits
- [ ] File storage: Supabase Storage vs AWS S3 — depends on file volume and cost
- [ ] PDF generation: server-side Puppeteer vs `@react-pdf/renderer` — need to test performance
- [ ] Agent mobile: PWA (Progressive Web App) sufficient, or does agent want native iOS/Android app?
- [ ] Mortgage calculator: build custom vs embed third-party widget?
- [ ] Testimonials: manual entry in dashboard vs pull from Google Reviews API?

### Resolved
- [x] Client auth: Magic link (email) for frictionless login — no password required. Supabase Auth handles this natively
- [x] Blog editor: TipTap WYSIWYG — toolbar-driven, no code, stores as JSON, renders to HTML
- [x] Saved searches: Registered users only. Guest-visible teaser prompt encourages sign-up
- [x] Booking: Requires account — guests redirected to registration flow before completing a booking
- [x] Listing display: MLS and manual listings look identical. Manual listings can be starred (agent-only toggle)

---

*Last updated: 2026-04-29*
*Plan maintained by: GeekReign-76*
