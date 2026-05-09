# Kaptivating Homes — Build Summary

**Agent:** Karsten Miller, REALTOR® — Keller Williams Charlotte Ballantyne Area  
**Document created:** 2026-05-09  
**Purpose:** Record of what was actually built, how it deviates from the original plan, and why each deviation was made.

---

## Table of Contents

1. [Overall Status](#1-overall-status)
2. [What Was Built vs. What Was Planned](#2-what-was-built-vs-what-was-planned)
3. [Major Deviations and Why](#3-major-deviations-and-why)
4. [Feature-by-Feature Build Log](#4-feature-by-feature-build-log)
5. [What Is Not Yet Built](#5-what-is-not-yet-built)
6. [Environment Variables Required Before Launch](#6-environment-variables-required-before-launch)

---

## 1. Overall Status

The platform is functionally complete for a public launch with one agent in the Charlotte, NC market. All core flows — property search, lead capture, messaging, live chat, appointments, blog, and the agent dashboard — are built and working. The multi-state MLS sync infrastructure exists and is ready for GA/FL expansion via configuration only.

The single largest deviation from the original plan is the **MLS/IDX integration strategy**. The plan assumed a direct API feed (Bridge Interactive or Spark API). In practice, Canopy MLS (the Charlotte-area MLS) does not grant direct API credentials to individual agents — they provide an IDX iframe only. Everything downstream of that decision cascaded into a new set of design choices described below.

---

## 2. What Was Built vs. What Was Planned

| Feature | Planned | Built | Status |
|---|---|---|---|
| Public homepage | Hero, featured listings, about, blog preview, contact | Hero + featured listings + about + blog preview + contact | ✅ Complete |
| Property search | Full filter UI with map (Mapbox) and list/grid toggle | IDX iframe embedded from Canopy MLS | ⚠️ Deviated — see Section 3 |
| Property detail page | Full detail view, photos, map, MLS data | Built — works for manual/MLS listings in backend | ✅ Complete |
| Relocate / community page | Not in original plan | Full page added — community profiles, browse by area | ✅ Added |
| IDX zip/city pre-filter | Not in plan (IDX was supposed to be API-driven) | Copy-to-clipboard zip prompt + email capture | ⚠️ Deviated — see Section 3 |
| MLS data sync (Bridge Interactive) | Background BullMQ sync job, ListingProvider abstraction | Infrastructure built; no live credentials | ⚠️ Infrastructure ready, not live |
| Manual listings | Full CRUD in agent dashboard | ✅ Built | ✅ Complete |
| Agent dashboard | Leads, messages, appointments, listings, blog, schedule | ✅ All sections built | ✅ Complete |
| Lead management | Table, status, notes, source | ✅ Built | ✅ Complete |
| Manual lead entry | Not explicitly in Phase 1 plan | Dashboard form for Karsten to manually add leads | ✅ Added |
| Zero-friction lead capture | Contact form only (original plan) | Chat widget, zip notify prompt, Save a Property button | ✅ Expanded |
| Internal messaging | REST + Socket.io, property cards, PDF attach | REST + Socket.io threads built | ✅ Complete |
| Attachment sharing in messages | Planned | Backend (documents.ts + Supabase Storage) ready; UI pending | ⏳ Backend done, frontend pending |
| Blast messaging to leads | Not in plan | Not yet built | ❌ Not built |
| Email forwarding from messaging | Planned via SendGrid | Backend SendGrid config in .env.example; not wired | ⏳ Pending SendGrid key |
| Live chat widget | Full Socket.io chat, status indicator, offline capture | ✅ Built — status indicator, offline capture, lead creation on session start | ✅ Complete |
| Appointment booking | Client picks slot, agent confirms/counter-proposes | ✅ Built — full status workflow including counter-propose | ✅ Complete |
| Agent schedule management | Dashboard UI for availability + blocked dates | ✅ Built — `/dashboard/schedule` | ✅ Complete |
| Blog | TipTap editor, draft/publish, public blog page | ✅ Built | ✅ Complete |
| WordPress blog import | Not in original plan | RSS feed pull from kaptivatinghomesbykarstenblog.wordpress.com | ✅ Added |
| Push notifications | Firebase Cloud Messaging (FCM) | Built using Web Push (VAPID) instead of FCM | ⚠️ Deviated — see Section 3 |
| Push on lead capture | Not in plan | Agent notified via `createNotification` on lead capture | ✅ Added |
| KW Ballantyne logo in hero | Not in original plan | Added as bottom-right corner badge | ✅ Added |
| Auth — client | Magic link (email) or Google OAuth | Magic link + email/password via Supabase Auth | ✅ Complete |
| Auth — agent | Email + password | ✅ | ✅ Complete |
| Saved properties | Registered clients only | ✅ Built | ✅ Complete |
| Saved searches | Registered clients only | ✅ Built | ✅ Complete |
| PDF generation per listing | Puppeteer or @react-pdf/renderer | Not built | ❌ Not built |
| Mortgage calculator | Custom or third-party embed | Not built | ❌ Not built |
| Mapbox property map | Interactive multi-state map with pins | Not built — IDX iframe replaced the search map | ❌ Replaced by IDX iframe |
| Test mode | Not in original plan | Full mock-data test mode built into apiClient | ✅ Added |
| Multi-state infrastructure | Built from day one | ✅ ListingProvider abstraction, state fields on all tables | ✅ Complete |

---

## 3. Major Deviations and Why

### 3.1 — MLS / IDX Integration: API Feed → Iframe Embed

**What the plan said:**  
Sign up with an IDX aggregator (Bridge Interactive or Spark API), get API credentials, sync listing data into our own PostgreSQL database every 12–24 hours. Build a full native search UI with filters, map (Mapbox), and property detail pages pulling from our own data.

**What was built:**  
The Canopy MLS (which covers the Charlotte, NC market Karsten operates in) does not issue direct API credentials to individual agents. The only integration available to Karsten through his current MLS membership is an **IDX iframe** — a browser-hosted embed from `matrix.canopymls.com`. The iframe is served from a domain we do not control, which means:

- It cannot be pre-populated with search parameters via URL (the iframe ignores `?zip=` and `?city=` on its own URL)
- It is cross-origin, so JavaScript on our page cannot read its DOM, listen to its events, or control its internal UI
- The map inside the iframe uses a Google Maps API key restricted to `matrix.canopymls.com`, making the map non-functional when proxied

**What we tried before settling:**  
1. URL parameter injection — ignored by the iframe, confirmed with network analysis
2. `postMessage` API — the iframe does not implement a message listener
3. HTML form targeting the iframe (`<form target="mls-iframe">`) — silently rejected because Canopy MLS uses ASP.NET UpdatePanel (AJAX partial postbacks) which require an `__RequestVerificationToken` CSRF token generated server-side per session
4. Backend proxy — built a server-side proxy route (`/api/idx-search`) that:
   - GETs the IDX page to capture session cookies and CSRF token
   - POSTs the search form with those credentials
   - Injects `<base href>` into the returned HTML so resources resolve back to the Matrix server
   - Returns the HTML to the client as a Blob URL loaded into the iframe
   — This technically worked but broke the Google Maps embed (domain-restricted API key) and required users to rely on the list view toggle. Ultimately not stable enough for a client-facing launch.
5. **Final decision:** Embed the Canopy MLS IDX iframe directly, and add a **copy-to-clipboard zip code prompt** that guides the user to paste the zip into the MLS iframe's own search field. This was validated by the client — the zip search returned 450 results in testing and the workflow is functional.

**Impact on downstream design:**  
- The Mapbox property map was removed — the IDX iframe has its own map
- The full-filter property search UI was not needed for MLS listings (the iframe provides its own)
- The `ListingProvider` / BullMQ sync infrastructure was still built because manual listings and future API access (if credentials are obtained) still need it
- Property detail pages still exist for manual listings but not for MLS listings (links inside the iframe go to Matrix's hosted detail pages)

---

### 3.2 — Push Notifications: Firebase Cloud Messaging → Web Push (VAPID)

**What the plan said:**  
Use Firebase Cloud Messaging (FCM) for web push delivery. This was listed in the tech stack as the primary notification delivery mechanism.

**What was built:**  
Web Push with VAPID keys directly, without Firebase. The notification system uses:
- `web-push` npm package on the backend
- VAPID public/private key pair stored in environment variables
- `PushSubscription` objects stored in the `push_subscriptions` table
- BullMQ worker (`notificationWorker.ts`) processes the `notifications` queue and calls `sendPushToUser` which calls the Web Push API directly
- Email fallback via SendGrid when push fails (queue-based, not yet live pending SendGrid key)

**Why the change:**  
Firebase requires a Google Services account and a `firebase-admin` SDK setup that adds complexity and a Google dependency. Web Push with VAPID achieves the same browser push notification result with less infrastructure. For a solo-agent platform, the additional Firebase console setup and service worker configuration overhead was not worth the limited benefit over raw VAPID. The W3C Web Push standard is supported natively by all modern browsers without Firebase.

---

### 3.3 — Lead Capture: Single Form → Three-Touch Zero-Friction System

**What the plan said:**  
Lead capture happens when a visitor submits the contact form or registers an account.

**What was built:**  
Three automatic capture touchpoints, none of which require filling out a traditional form:

1. **Chat widget** — when a visitor opens the chat and sends their first message, a lead record is created automatically (name + email are optional fields in the chat form, but the session itself is captured regardless). Built into `chatService.ts`.

2. **Zip notify prompt** — after a user copies the zip code from the `IdxSearchBanner` popup, an email field slides in: *"Get new listings in [zip] emailed to you."* Single tap, no form submission flow. Lead created via `POST /api/v1/leads/capture`.

3. **Save a Property button** — a floating pill on the listings page. When tapped, a small modal asks for name (optional) and email. On submit, lead created and Karsten is notified. The button is delayed by 9 seconds when arriving via the relocate page (to let the `IdxSearchBanner` overlay clear first).

**Why the change:**  
The client pointed out that requiring visitors to fill out a form before they've expressed interest creates friction that drives leads away. The three-touch system captures intent at the moment it's shown — when someone copies a zip code they want to live in, or when they want to save a property they found.

A public endpoint `POST /api/v1/leads/capture` was added to support unauthenticated lead creation. It upserts a `users` record by email and creates a `leads` record if one doesn't already exist. Duplicate submissions (same email across multiple touchpoints) produce a single lead record — not duplicates.

---

### 3.4 — Relocate Page: Not in Original Plan

**What the plan said:**  
The original plan had no relocate or community page in the route list.

**What was built:**  
A full `/relocate` page with detailed community profiles for Charlotte's international neighborhoods: Indian/South Asian (Ballantyne corridor), Hispanic/Latino (Central Avenue), Korean (Matthews), Muslim/Middle Eastern (greater Charlotte), and Chinese/East Asian communities. Each community card includes:
- Cultural description
- Population stats
- Key restaurants, places of worship, and community events
- A "Browse Listings" button that navigates to `/listings?city=X&zip=Y` with the community's zip code pre-loaded

**Why it was added:**  
Karsten's market differentiator is his personal experience as a relocation specialist for international families coming to Charlotte. This page became a centerpiece of his marketing strategy and the primary driver of his listing search traffic. It was elevated to a priority feature because it directly reflects how Karsten markets himself and why clients choose him over other agents.

---

### 3.5 — Agent Notification on Lead Capture: New Feature

**What the plan said:**  
Agent notifications were scoped to: new message, new appointment booking, appointment reminder, new time suggestion.

**What was built:**  
An additional notification event: **new lead captured**. When `POST /api/v1/leads/capture` creates a new lead record, it fires `createNotification()` targeting the agent's user ID (`AGENT_USER_ID` env var). The notification includes the lead's name, email, and capture source (zip area alert, saved property, etc.).

**Why it was added:**  
Zero-friction lead capture only works if the agent is actually notified when someone enters their email. Without this, leads could sit in the database for days unnoticed.

---

### 3.6 — WordPress Blog Import: Not in Original Plan

**What the plan said:**  
Karsten writes posts in the in-app TipTap editor. No external blog import.

**What was built:**  
Integration with Karsten's existing WordPress.com blog at `kaptivatinghomesbykarstenblog.wordpress.com` via RSS feed. The WordPress REST API endpoint returned a 404 (not available for this WordPress.com plan tier), so the RSS feed (`/feed/`) was used instead. Blog posts from WordPress are pulled and displayed alongside posts written natively in the dashboard.

**Why it was added:**  
Karsten already had published blog content on WordPress that represented real marketing value. Duplicating those posts manually or abandoning them was not acceptable. The RSS feed approach requires no WordPress credentials, works on all WordPress.com plans, and is read-only (content continues to be authored on WordPress while the platform displays it).

---

### 3.7 — KW Ballantyne Logo Placement

**What the plan said:**  
Branding assets to be provided by client and placed in design. No specific placement specified.

**What was built:**  
The KW Charlotte Ballantyne Area Realty logo is placed as a **bottom-right corner badge** on the hero section of the homepage. It uses a semi-transparent frosted-glass container (`bg-white/90 backdrop-blur-sm`) so it reads cleanly against the hero photography without dominating the layout. The logo file is stored at `public/kw-ballantyne-logo.png`.

Earlier attempts placed it above the headline (visually competed with the hero text) and at the top center (felt like a nav element rather than a brand affiliation). The bottom-right corner was chosen as the right balance: visible, clearly an affiliation badge, not fighting the hero copy.

---

## 4. Feature-by-Feature Build Log

### Public Site

**`/` — Homepage**  
Built as planned. Contains: hero section with zip search bar, featured listings carousel, about section, blog preview, contact form section. The KW Ballantyne logo was added as a bottom-right hero badge (not in original plan). The hero search navigates to `/listings?zip=XXXXX` which triggers the zip copy workflow.

**`/listings` — Property Search**  
Replaced the planned native filter UI + Mapbox map with the Canopy MLS IDX iframe (see Section 3.1). The page layout is a full-height iframe with the `IdxSearchBanner` overlay (shown when a zip is passed in the URL) and the `SaveListingPrompt` floating button (shown after a delay when arriving via the relocate page).

**`/listings/[id]` — Property Detail**  
Built as a native detail page for manual listings and future API-sourced MLS listings. Not used for Canopy MLS listings (those are hosted on Matrix's own detail pages inside the iframe).

**`/relocate` — Community Relocation Guide**  
Not in the original plan. Full community profiles with browse-by-area buttons (see Section 3.4).

**`/blog` and `/blog/[slug]`**  
Built as planned. Pulls from the in-app blog database. WordPress blog is imported alongside it via RSS feed (not in original plan).

**`/auth/login` and `/auth/register`**  
Built as planned using Supabase Auth. Magic link + email/password both supported.

---

### Client Portal

**`/portal`** — Dashboard with saved listings, quick links. Built as planned.  
**`/portal/messages`** — Full messaging thread UI. Built as planned.  
**`/portal/appointments`** — Booking flow with slot picker, suggest-a-time, and status tracking. Built as planned.  
**`/portal/saved`** — Saved listings and saved searches. Built as planned.

---

### Agent Dashboard

**`/dashboard`** — Overview stats, recent leads, upcoming appointments. Built as planned.  
**`/dashboard/leads`** — Leads table with status filter, notes, expandable detail. Built as planned. Manual lead entry form added (not in original plan).  
**`/dashboard/messages`** — Agent messaging UI with unread badges, thread view, reply. Built as planned. Attachment sharing (frontend) is pending.  
**`/dashboard/appointments`** — Appointment queue with confirm/counter/cancel. Built as planned.  
**`/dashboard/listings`** — Manual listing CRUD, star toggle, MLS listing view. Built as planned.  
**`/dashboard/blog`** — TipTap editor with draft/publish workflow, image upload. Built as planned.  
**`/dashboard/schedule`** — Weekly availability windows, blocked dates, appointment type configuration. Built as planned. This was listed as "not yet a dashboard UI" in the original how-this-works doc — it is now built.

---

### Backend Services

**API server** — Node.js + Express, all planned endpoint groups implemented.  
**Socket.io** — Messaging and live chat real-time delivery. Built as planned.  
**BullMQ** — Notification queue operational. MLS sync job infrastructure built but not live (no Bridge Interactive credentials).  
**Supabase** — Auth + PostgreSQL + Storage. Used as planned.  
**Notification worker** — Web Push (VAPID) instead of FCM (see Section 3.2). Email fallback queue built, pending SendGrid key.  

**New endpoint not in original plan:**  
`POST /api/v1/leads/capture` — Public endpoint (no auth) for zero-friction lead capture from the listings page.

---

### Test Mode

Not in the original plan. A full mock-data layer was built into `apiClient.ts` that intercepts all API calls and returns realistic mock data (12 listings, sample leads, messages, appointments, blog posts). Enabled via `NEXT_PUBLIC_TEST_MODE=true` or a floating toggle button. This allows the full UI to be demoed without a running backend or Supabase connection.

---

## 5. What Is Not Yet Built

These items were in the plan but were deferred:

| Feature | Notes |
|---|---|
| **Bridge Interactive MLS sync (live)** | Infrastructure ready. Waiting on IDX credentials from Canopy MLS or an aggregator account. No code changes needed — add env vars and the sync starts. |
| **Attachment sharing in messages (frontend)** | Backend (`documents.ts`, Supabase Storage) is complete. The frontend message composer does not yet have an attach/share button. |
| **Blast correspondence to leads** | Not in original plan. Requested at launch prep. Needs bulk message send UI in dashboard + SendGrid integration. |
| **Email forwarding from messaging** | SendGrid env vars are in `.env.example`. The email queue is in the notification worker. Not live pending `SENDGRID_API_KEY`. |
| **PDF generation per listing** | Was in plan. Not built — the IDX iframe deviation made this less critical (MLS listings are viewed in Matrix's own detail pages). Can be built for manual listings using `@react-pdf/renderer`. |
| **Mortgage calculator** | Not built. Can be a third-party embed (e.g., Bankrate widget) added in one line. |
| **GA and FL MLS connections** | Infrastructure ready. Waiting on MLS memberships in those states. |
| **CRM integrations (Follow Up Boss, etc.)** | Not in scope. |
| **Mobile app (React Native / Expo)** | Separate engagement. Not started. |
| **Agent content management UI** | Homepage hero text, bio, and testimonials are hardcoded in components rather than editable from the dashboard. The plan called for these to be dashboard-editable. |

---

## 6. Environment Variables Required Before Launch

The following env vars must be set before the site goes live. Most are in `.env.example` files in both `frontend/` and `backend/`.

### Frontend (`frontend/.env.local`)

| Variable | Purpose | Status |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | Set when backend is deployed |
| `NEXT_PUBLIC_AGENT_NAME` | Karsten Miller | Set |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Set |
| `NEXT_PUBLIC_TEST_MODE` | Set to `false` for production | Must be `false` |

### Backend (`backend/.env`)

| Variable | Purpose | Status |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres connection string | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access to Supabase | Set |
| `REDIS_URL` | Upstash or self-hosted Redis | Set |
| `VAPID_PUBLIC_KEY` | Web Push public key | Set |
| `VAPID_PRIVATE_KEY` | Web Push private key | Set |
| `VAPID_SUBJECT` | Web Push contact email | Set |
| `AGENT_USER_ID` | Karsten's Supabase user UUID — required for lead capture notifications | **Not set — get from Supabase Auth dashboard after first login** |
| `SENDGRID_API_KEY` | Email delivery — required for email fallback on notifications and forwarding | **Not set — obtain SendGrid account** |
| `SENDGRID_FROM_EMAIL` | From address for all outbound email | **Not set** |
| `BRIDGE_SC_*` | Bridge Interactive MLS credentials for SC | **Not set — pending IDX agreement** |

---

*Build summary maintained by: GeekReign-76*  
*Last updated: 2026-05-09*
