# How This Works  -  Kaptivating Homes Platform

A plain-English guide to every part of the system, written for the agent and anyone onboarding to the project.

---

## What This Is

A full real estate web platform built specifically for one agent. It handles everything a buyer or seller touches  -  searching properties, booking showings, messaging the agent, and reading blog posts  -  plus a private dashboard where the agent manages all of it.

---

## The Two Sides of the App

### Public Site (what buyers see)

| Page | What it does |
|---|---|
| `/` | Home page  -  hero search bar, featured listings, about section, latest blog posts, contact form |
| `/listings` | Browse and filter all properties (state, price, beds/baths, type) |
| `/listings/[id]` | Full property detail  -  photo gallery, specs, map, contact/book button |
| `/blog` | All published blog posts |
| `/blog/[slug]` | Individual post |
| `/auth/register` | Create an account |
| `/auth/login` | Sign in |

Any visitor can browse listings. To **book a showing** or **save a listing/search**, they must create a free account. This is intentional  -  it captures lead info.

### Client Portal (what registered buyers see after login)

| Page | What it does |
|---|---|
| `/portal` | Dashboard  -  saved listings, quick links |
| `/portal/messages` | Direct messaging thread with the agent |
| `/portal/appointments` | View, book, and manage showings |
| `/portal/saved` | Saved listings and saved searches |

### Agent Dashboard (private  -  agent only)

| Page | What it does |
|---|---|
| `/dashboard` | Overview  -  key stats, recent leads, upcoming appointments |
| `/dashboard/leads` | All leads with status, notes, source tracking |
| `/dashboard/messages` | Reply to all client conversations |
| `/dashboard/appointments` | View, confirm, and cancel appointment requests |
| `/dashboard/listings` | Manage manually-added listings + view MLS feed |
| `/dashboard/blog` | Publish, draft, edit, and delete blog posts |

---

## How the Key Features Work

### Property Listings

There are two types of listings:

1. **MLS Feed**  -  Properties synced automatically from the MLS provider (Bridge Interactive). A background job runs every 15 minutes to pull in new listings and update statuses. The agent doesn't touch these.

2. **Manual Listings**  -  Properties the agent adds directly through the dashboard (pocket listings, off-market deals, etc.). Full control over all fields.

Both appear together on the public search page. MLS listings show a source badge; manual listings can be starred to show a "Featured" badge.

### Lead Capture

A lead is created automatically whenever someone:
- Submits the contact form on the home page
- Starts a live chat
- Registers an account
- Books an appointment

Every lead shows up in `/dashboard/leads` with their name, email, source, and a status the agent manually updates (Hot → Warm → Cold → Closed). The agent can add private notes per lead.

### Messaging

**Live Chat (pre-account)**  -  A floating chat bubble on every public page. Visitors can message the agent without creating an account. The agent sees these in real time. If the visitor then registers, the chat session converts into a full messaging thread tied to their account.

**Messaging Threads (post-account)**  -  Once a visitor creates an account, they get a full two-way messaging inbox. The agent sees all threads in `/dashboard/messages`, sorted by unread first. Messages support plain text, property card attachments (share a listing inline), and PDF attachments.

Messages are delivered in real time using WebSockets (Socket.io). If the browser isn't open, push notifications are sent instead.

### Appointments

The booking flow works like this:

1. Client clicks "Book a Showing" on a listing page or in the portal
2. They pick an appointment type (Showing, Buyer Consultation, Offer Review)
3. They pick from available time slots
4. They confirm  -  the agent gets notified
5. Agent can **Confirm**, **Cancel**, or **Counter-Propose** a different time
6. If counter-proposed, the client is notified and can accept or decline
7. Once confirmed, both parties get a calendar invite via email

The agent sets available time slots and appointment types from the backend configuration (not yet a dashboard UI  -  on the roadmap).

### Blog

The agent writes and publishes posts through `/dashboard/blog`. Posts are written in a rich text editor (bold, headings, images, links, etc.) with auto-save every 2 seconds. Posts stay as **drafts** until the agent explicitly publishes them. Published posts appear on the public `/blog` page and the home page preview.

Each post has a title, excerpt, cover image, tags, and auto-calculated read time. The agent can unpublish a post to pull it back to draft at any time.

### Saved Searches

When a logged-in buyer saves a search (e.g. "3BR under $500k in Charleston"), a background job checks new MLS listings against all saved searches every 15 minutes. If a match is found, the client gets a push notification and/or email with the new listing.

### Push Notifications

Clients who allow browser notifications receive alerts for:
- New message from the agent
- Appointment confirmed/counter-proposed
- New listing matching a saved search

The agent gets alerts for:
- New message from a client
- New appointment request

---

## Test Mode

The app has a built-in **test mode** that lets you demo the full UI without a live backend or Supabase account. All API calls are intercepted and return realistic mock data  -  12 SC/GA/FL listings, sample clients, messages, appointments, leads, and blog posts.

**To enable test mode:**
- Set `NEXT_PUBLIC_TEST_MODE=true` in `frontend/.env.local` (already set for local dev)
- Or click the floating "Test Mode" button in the bottom-right corner of any page

**To disable test mode:**
- Remove/set the env var to `false` and restart
- Or click "Disable Test Mode" in the yellow banner at the bottom of the screen

When test mode is off, the app connects to the real Supabase auth and the real backend API.

---

## The Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Server + client rendering, fast pages, SEO |
| Styling | Tailwind CSS | Utility-first, easy to customize brand colors |
| Auth | Supabase Auth | Email/password + magic link, JWT sessions |
| Database | Supabase (Postgres) | Managed, real-time capable, row-level security |
| Backend API | Node.js + Express | REST API the frontend calls for all data |
| Real-time | Socket.io | Live chat and messaging |
| Background Jobs | BullMQ + Redis | MLS sync, notification matching, email sending |
| Push Notifications | Web Push (VAPID) | Browser push without an app |
| MLS Data | Bridge Interactive | Real listing data for SC (GA/FL when ready) |
| Email | SendGrid | Calendar invites, notification emails |
| Frontend Hosting | Vercel | Auto-deploys on git push |
| Backend Hosting | Railway | Node API + worker processes |

---

## How Deployments Work

1. Push code to the `main` branch on GitHub
2. GitHub Actions runs type checking and linting automatically
3. If checks pass:
   - Vercel picks up the frontend and deploys it (usually under 2 minutes)
   - Railway picks up the backend and redeploys the API and worker
4. No manual steps needed

For the very first deployment, environment variables need to be set in the Vercel and Railway dashboards (Supabase keys, MLS credentials, etc.). See `frontend/.env.example` and `backend/.env.example` for the full list.

---

## Adding GA and FL Listings

The system is built to support multiple states. Currently only SC is wired to the MLS feed. To add Georgia or Florida:

1. Obtain Bridge Interactive credentials for the GA or FL market
2. Add the env vars (`BRIDGE_GA_*` / `BRIDGE_FL_*`) to the backend
3. Register a new provider in `backend/src/providers/ProviderRegistry.ts`
4. The sync jobs pick it up automatically on the next run

No frontend changes needed  -  the search filters already include GA and FL.

---

## Accounts and Roles

There are two roles:

| Role | How you get it | What it unlocks |
|---|---|---|
| `client` | Register on the site | Portal, messaging, appointments, saved searches |
| `agent` | Set manually in Supabase | Full dashboard access |

The agent account is set up once in the Supabase dashboard by changing `user_metadata.role` to `"agent"`. There is intentionally only one agent account  -  this is a solo-agent platform.

---

## What's Not Built Yet

- Agent availability/slot management UI (currently configured in the backend)
- GA and FL MLS connections (infrastructure ready, credentials needed)
- CRM integrations (Follow Up Boss, etc.)
- Mobile app
