-- ============================================================
-- KAPTIVATING HOMES — PostgreSQL Database Schema
-- Platform: Supabase (PostgreSQL 15+)
-- Last updated: 2026-04-29
-- ============================================================
-- CONVENTIONS:
--   - All primary keys: UUID (gen_random_uuid())
--   - All timestamps: TIMESTAMPTZ (UTC)
--   - Soft deletes where appropriate (is_active / status fields)
--   - Listing data: MLS source data NEVER modified directly
--     Agent customizations stored in listing_overrides table
--   - Multi-state: every listing-related table carries state CHAR(2)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for geo proximity queries


-- ============================================================
-- 1. MARKETS & MLS SOURCES
-- ============================================================
-- One row per active MLS connection.
-- Adding GA or FL = INSERT a row + deploy a new ListingProvider class.
-- No schema changes required.

CREATE TABLE markets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state                CHAR(2)       NOT NULL,          -- 'SC', 'GA', 'FL'
  mls_name             VARCHAR(100)  NOT NULL,          -- 'Consolidated MLS', 'FMLS'
  provider_class       VARCHAR(100)  NOT NULL,          -- 'SCListingProvider'
  is_active            BOOLEAN       DEFAULT false,
  sync_interval_hours  INT           DEFAULT 12,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   DEFAULT now(),
  updated_at           TIMESTAMPTZ   DEFAULT now()
);

-- Seed SC at launch
INSERT INTO markets (state, mls_name, provider_class, is_active)
VALUES ('SC', 'Consolidated MLS (CMLS)', 'SCListingProvider', true);


-- ============================================================
-- 2. MLS LISTINGS (cached from IDX feed)
-- ============================================================
-- Source of truth is the MLS feed. This table is read-only
-- from the application's perspective — only the sync job writes here.
-- Agent customizations go in listing_overrides.

CREATE TABLE listings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_id               VARCHAR(50)   NOT NULL,
  mls_source           VARCHAR(100)  NOT NULL,          -- 'CMLS', 'FMLS', 'Stellar'
  market_id            UUID          REFERENCES markets(id) ON DELETE SET NULL,
  state                CHAR(2)       NOT NULL,
  region               VARCHAR(100),                    -- 'Lowcountry', 'Upstate SC', etc.

  -- Address
  address              VARCHAR(255)  NOT NULL,
  city                 VARCHAR(100)  NOT NULL,
  county               VARCHAR(100),
  zip                  VARCHAR(10)   NOT NULL,
  lat                  DECIMAL(10,8),
  lng                  DECIMAL(11,8),
  geo                  GEOGRAPHY(POINT, 4326),          -- PostGIS point for proximity queries

  -- Property details
  price                DECIMAL(12,2),
  beds                 SMALLINT,
  baths                DECIMAL(3,1),
  half_baths           SMALLINT      DEFAULT 0,
  sqft                 INT,
  lot_size             DECIMAL(10,2),
  lot_unit             VARCHAR(20)   DEFAULT 'sqft',    -- 'sqft' | 'acres'
  year_built           SMALLINT,
  property_type        VARCHAR(50),
  -- 'Single Family' | 'Condo' | 'Townhouse' | 'Multi-Family' | 'Land' | 'Commercial'

  -- MLS status
  mls_status           VARCHAR(50),
  -- 'Active' | 'Pending' | 'Sold' | 'Withdrawn' | 'Expired' | 'Coming Soon'

  -- Content
  description          TEXT,
  photos               JSONB         DEFAULT '[]',
  -- [{url: string, order: int, caption: string|null}]
  features             JSONB         DEFAULT '{}',
  -- {garage: bool, pool: bool, waterfront: bool, ...}

  -- IDX attribution (required by all MLS compliance rules)
  listing_agent_name   VARCHAR(200),
  listing_agent_mlsid  VARCHAR(50),
  listing_office_name  VARCHAR(200),
  listing_office_mlsid VARCHAR(50),

  -- Timestamps
  listed_at            TIMESTAMPTZ,
  price_changed_at     TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ   DEFAULT now(),
  created_at           TIMESTAMPTZ   DEFAULT now(),
  updated_at           TIMESTAMPTZ   DEFAULT now(),

  UNIQUE (mls_id, mls_source)
);

CREATE INDEX idx_listings_state          ON listings(state);
CREATE INDEX idx_listings_status         ON listings(mls_status);
CREATE INDEX idx_listings_city           ON listings(city);
CREATE INDEX idx_listings_price          ON listings(price);
CREATE INDEX idx_listings_beds           ON listings(beds);
CREATE INDEX idx_listings_property_type  ON listings(property_type);
CREATE INDEX idx_listings_geo            ON listings USING GIST(geo);
CREATE INDEX idx_listings_synced_at      ON listings(synced_at DESC);


-- ============================================================
-- 3. LISTING OVERRIDES (agent display layer — never touches MLS data)
-- ============================================================
-- One row per listing (if agent has customized it).
-- All fields are additive / display-only. Source data in listings is untouched.

CREATE TABLE listing_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID          UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  custom_headline   VARCHAR(255),
  -- e.g. "Stunning Waterfront Retreat — Motivated Seller!"

  highlight_tags    TEXT[]        DEFAULT '{}',
  -- e.g. ['Price Reduced', 'Just Listed', 'New Construction', 'Hot Deal', 'Open House']

  is_featured       BOOLEAN       DEFAULT false,  -- pins to homepage carousel
  is_hidden         BOOLEAN       DEFAULT false,  -- suppress from public display

  agent_notes       TEXT,         -- internal only, NEVER exposed via API to public
  extra_photos      JSONB         DEFAULT '[]',   -- additional photos beyond MLS
  extra_documents   JSONB         DEFAULT '[]',   -- [{name, url, type}]

  created_at        TIMESTAMPTZ   DEFAULT now(),
  updated_at        TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_listing_overrides_featured ON listing_overrides(is_featured) WHERE is_featured = true;
CREATE INDEX idx_listing_overrides_hidden   ON listing_overrides(is_hidden)   WHERE is_hidden = true;


-- ============================================================
-- 4. MANUAL LISTINGS (off-MLS / pocket listings)
-- ============================================================
-- Fully agent-managed. Displayed identically to MLS listings on the public site.
-- is_starred = agent highlight (bold border, star badge) — visible to public.

CREATE TABLE manual_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Address
  address         VARCHAR(255)  NOT NULL,
  city            VARCHAR(100)  NOT NULL,
  county          VARCHAR(100),
  state           CHAR(2)       NOT NULL,
  zip             VARCHAR(10)   NOT NULL,
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  geo             GEOGRAPHY(POINT, 4326),

  -- Property details (same shape as listings table)
  price           DECIMAL(12,2),
  beds            SMALLINT,
  baths           DECIMAL(3,1),
  half_baths      SMALLINT      DEFAULT 0,
  sqft            INT,
  lot_size        DECIMAL(10,2),
  lot_unit        VARCHAR(20)   DEFAULT 'sqft',
  year_built      SMALLINT,
  property_type   VARCHAR(50),

  -- Content
  title           VARCHAR(255),
  description     TEXT,
  photos          JSONB         DEFAULT '[]',
  features        JSONB         DEFAULT '{}',
  documents       JSONB         DEFAULT '[]',

  -- Display overrides (built-in for manual listings)
  custom_headline  VARCHAR(255),
  highlight_tags   TEXT[]        DEFAULT '{}',
  is_featured      BOOLEAN       DEFAULT false,
  is_starred       BOOLEAN       DEFAULT false,
  -- is_starred: agent-toggled visual emphasis (star badge on listing card)

  -- Status
  status           VARCHAR(20)  DEFAULT 'Active'
                   CHECK (status IN ('Draft', 'Active', 'Pending', 'Sold', 'Archived')),
  is_active        BOOLEAN      DEFAULT true,

  created_at       TIMESTAMPTZ  DEFAULT now(),
  updated_at       TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_manual_listings_state    ON manual_listings(state);
CREATE INDEX idx_manual_listings_status   ON manual_listings(status);
CREATE INDEX idx_manual_listings_featured ON manual_listings(is_featured) WHERE is_featured = true;
CREATE INDEX idx_manual_listings_starred  ON manual_listings(is_starred)  WHERE is_starred = true;
CREATE INDEX idx_manual_listings_geo      ON manual_listings USING GIST(geo);


-- ============================================================
-- 5. USERS
-- ============================================================
-- id matches Supabase auth.users.id (UUID).
-- Two roles: 'agent' (one, the owner) and 'client' (all registered visitors).

CREATE TABLE users (
  id                UUID PRIMARY KEY,
  -- NOTE: matches auth.users.id from Supabase Auth — do NOT use gen_random_uuid() here

  email             VARCHAR(255)  UNIQUE NOT NULL,
  phone             VARCHAR(20),
  full_name         VARCHAR(200),
  avatar_url        TEXT,
  role              VARCHAR(10)   DEFAULT 'client'
                    CHECK (role IN ('agent', 'client')),

  -- Client preferences (used to pre-fill search and saved search suggestions)
  preferred_states  TEXT[]        DEFAULT '{}',
  preferred_cities  TEXT[]        DEFAULT '{}',

  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   DEFAULT now(),
  updated_at        TIMESTAMPTZ   DEFAULT now()
);


-- ============================================================
-- 6. LEADS
-- ============================================================
-- Enriched profile layered on top of a user record.
-- Created automatically when a user registers, books, or chats.

CREATE TABLE leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  source                VARCHAR(50),
  -- 'registration' | 'contact_form' | 'chat' | 'booking' | 'property_inquiry' | 'saved_search'

  source_listing_id     UUID,         -- which listing triggered the lead (if any)
  source_listing_type   VARCHAR(10)   CHECK (source_listing_type IN ('mls', 'manual')),

  tags                  TEXT[]        DEFAULT '{}',
  -- ['Buyer', 'Seller', 'Hot', 'Nurture', 'Closed', 'Archived']

  agent_notes           TEXT,         -- internal, never shown to client

  first_seen_at         TIMESTAMPTZ   DEFAULT now(),
  last_active_at        TIMESTAMPTZ   DEFAULT now(),
  created_at            TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_leads_user_id  ON leads(user_id);
CREATE INDEX idx_leads_tags     ON leads USING GIN(tags);


-- ============================================================
-- 7. SAVED PROPERTIES
-- ============================================================
-- Registered clients only. Supports both MLS and manual listings.
-- CHECK constraint ensures exactly one of listing_id / manual_listing_id is set.

CREATE TABLE saved_properties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  listing_id          UUID          REFERENCES listings(id)        ON DELETE CASCADE,
  manual_listing_id   UUID          REFERENCES manual_listings(id)  ON DELETE CASCADE,
  listing_type        VARCHAR(10)   NOT NULL CHECK (listing_type IN ('mls', 'manual')),

  saved_at            TIMESTAMPTZ   DEFAULT now(),

  -- Enforce one listing per save row, no duplicates per user
  UNIQUE (user_id, listing_id),
  UNIQUE (user_id, manual_listing_id),
  CHECK (
    (listing_id IS NOT NULL AND manual_listing_id IS NULL)
    OR
    (listing_id IS NULL AND manual_listing_id IS NOT NULL)
  )
);

CREATE INDEX idx_saved_properties_user_id ON saved_properties(user_id);


-- ============================================================
-- 8. SAVED SEARCHES (registered users only)
-- ============================================================
-- Guests see a teaser prompt: "Sign up to save your search and get alerts"
-- The frontend enforces registration gate — not enforced at DB level
-- (auth middleware handles it) but user_id NOT NULL makes intent clear.

CREATE TABLE saved_searches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name                  VARCHAR(100)  NOT NULL,
  -- User-assigned name: "3BR under $400k Columbia SC"

  filters               JSONB         NOT NULL,
  -- {
  --   states: ['SC'],
  --   cities: ['Columbia', 'Lexington'],
  --   min_price: 200000,
  --   max_price: 400000,
  --   min_beds: 3,
  --   min_baths: 2,
  --   property_types: ['Single Family'],
  --   keywords: 'pool waterfront'
  -- }

  notify_on_new_match   BOOLEAN       DEFAULT true,
  last_checked_at       TIMESTAMPTZ,

  created_at            TIMESTAMPTZ   DEFAULT now(),
  updated_at            TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_notify
  ON saved_searches(notify_on_new_match)
  WHERE notify_on_new_match = true;


-- ============================================================
-- 9. MESSAGING — THREADS
-- ============================================================

CREATE TABLE threads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID          REFERENCES users(id) ON DELETE SET NULL,

  -- Optional: thread initiated from a specific listing
  related_listing_id      UUID,
  related_listing_type    VARCHAR(10)   CHECK (related_listing_type IN ('mls', 'manual')),

  subject                 VARCHAR(255),
  -- Auto-generated: "Re: 123 Oak St, Columbia SC" or agent-set

  -- Denormalized unread counts for fast inbox badge rendering
  agent_unread_count      INT           DEFAULT 0,
  client_unread_count     INT           DEFAULT 0,

  last_message_at         TIMESTAMPTZ   DEFAULT now(),
  created_at              TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_threads_client_id       ON threads(client_id);
CREATE INDEX idx_threads_last_message_at ON threads(last_message_at DESC);


-- ============================================================
-- 10. MESSAGING — MESSAGES
-- ============================================================

CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID          NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id     UUID          REFERENCES users(id) ON DELETE SET NULL,
  sender_role   VARCHAR(10)   NOT NULL CHECK (sender_role IN ('agent', 'client', 'system')),

  message_type  VARCHAR(20)   NOT NULL
                CHECK (message_type IN ('text', 'property_card', 'pdf', 'image', 'system')),

  content       TEXT,
  -- For text: the message body
  -- For system: the event description ("Appointment confirmed for May 3rd at 2pm")

  metadata      JSONB         DEFAULT '{}',
  -- property_card: { listing_id, listing_type, address, city, price, photo_url, beds, baths }
  -- pdf:           { document_id, file_url, file_name, file_size_bytes }
  -- image:         { file_url, file_name, width, height }

  sent_at       TIMESTAMPTZ   DEFAULT now(),
  read_at       TIMESTAMPTZ   -- NULL = unread
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_sent_at   ON messages(sent_at DESC);
CREATE INDEX idx_messages_unread    ON messages(thread_id, read_at) WHERE read_at IS NULL;


-- ============================================================
-- 11. LIVE CHAT SESSIONS (pre-registration / guest chat)
-- ============================================================
-- Captures guest identity before they register.
-- On registration or conversion, linked to a user and/or thread.

CREATE TABLE chat_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Guest identity (captured during chat, before any account exists)
  guest_name            VARCHAR(200),
  guest_email           VARCHAR(255),
  guest_phone           VARCHAR(20),

  -- Linked once guest registers
  user_id               UUID          REFERENCES users(id) ON DELETE SET NULL,

  -- Linked once agent converts chat to full messaging thread
  converted_thread_id   UUID          REFERENCES threads(id) ON DELETE SET NULL,

  status                VARCHAR(20)   DEFAULT 'waiting'
                        CHECK (status IN ('waiting', 'active', 'closed', 'converted')),

  started_at            TIMESTAMPTZ   DEFAULT now(),
  agent_joined_at       TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ
);

CREATE TABLE chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID          NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_type   VARCHAR(10)   NOT NULL CHECK (sender_type IN ('agent', 'guest', 'system')),
  content       TEXT          NOT NULL,
  sent_at       TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);


-- ============================================================
-- 12. CALENDAR — APPOINTMENT TYPES
-- ============================================================

CREATE TABLE appointment_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100)  NOT NULL,
  -- 'Home Tour', 'Buyer Consultation', 'Seller Consultation', 'Phone Call'
  description      TEXT,
  duration_minutes INT           NOT NULL DEFAULT 60,
  buffer_minutes   INT           NOT NULL DEFAULT 15,
  -- Buffer AFTER appointment before next slot opens
  color            VARCHAR(7)    DEFAULT '#3B82F6', -- hex, for calendar UI
  is_active        BOOLEAN       DEFAULT true,
  display_order    INT           DEFAULT 0,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

-- Seed default appointment types
INSERT INTO appointment_types (name, description, duration_minutes, buffer_minutes, color, display_order) VALUES
  ('Home Tour',            'Tour a specific property together',        90, 15, '#10B981', 1),
  ('Buyer Consultation',   'Discuss buying goals, budget, and process', 60, 15, '#3B82F6', 2),
  ('Seller Consultation',  'Discuss listing your home',                 60, 15, '#8B5CF6', 3),
  ('Phone Call',           'Quick phone conversation',                  30, 10, '#F59E0B', 4);


-- ============================================================
-- 13. CALENDAR — AGENT AVAILABILITY
-- ============================================================

-- Recurring weekly windows (e.g., Mon–Sat, 9am–6pm)
CREATE TABLE availability_windows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  SMALLINT      NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time   TIME          NOT NULL,
  end_time     TIME          NOT NULL,
  is_active    BOOLEAN       DEFAULT true,
  CHECK (start_time < end_time)
);

-- One-off blocked dates / time ranges (vacation, personal time)
CREATE TABLE availability_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE          NOT NULL,
  start_time   TIME,         -- NULL = entire day is blocked
  end_time     TIME,
  reason       VARCHAR(255), -- internal only, not shown to clients
  created_at   TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_availability_blocks_date ON availability_blocks(blocked_date);


-- ============================================================
-- 14. APPOINTMENTS
-- ============================================================

CREATE TABLE appointments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID          NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  appointment_type_id     UUID          REFERENCES appointment_types(id),

  -- Optional: tied to a specific property
  related_listing_id      UUID,
  related_listing_type    VARCHAR(10)   CHECK (related_listing_type IN ('mls', 'manual')),

  -- Requested time (always set — what client originally asked for)
  requested_start         TIMESTAMPTZ   NOT NULL,
  requested_end           TIMESTAMPTZ   NOT NULL,

  -- Confirmed time (may differ if agent counter-proposed)
  confirmed_start         TIMESTAMPTZ,
  confirmed_end           TIMESTAMPTZ,

  -- Counter-proposed time (set when agent proposes a different slot)
  counter_start           TIMESTAMPTZ,
  counter_end             TIMESTAMPTZ,

  -- Workflow status
  status                  VARCHAR(25)   DEFAULT 'pending'
                          CHECK (status IN (
                            'pending',           -- client booked open slot, auto-confirm OR awaiting agent
                            'suggested',         -- client suggested custom time, awaiting agent
                            'confirmed',         -- appointment is locked in
                            'counter_proposed',  -- agent proposed different time, awaiting client
                            'cancelled_client',
                            'cancelled_agent',
                            'completed',
                            'no_show'
                          )),

  -- Notes
  client_note             TEXT,
  agent_note              TEXT,
  cancellation_reason     TEXT,

  -- Notification tracking
  confirmation_sent       BOOLEAN       DEFAULT false,
  reminder_24h_sent       BOOLEAN       DEFAULT false,
  reminder_1h_sent        BOOLEAN       DEFAULT false,

  created_at              TIMESTAMPTZ   DEFAULT now(),
  updated_at              TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_appointments_client_id     ON appointments(client_id);
CREATE INDEX idx_appointments_status        ON appointments(status);
CREATE INDEX idx_appointments_confirmed_at  ON appointments(confirmed_start);
CREATE INDEX idx_appointments_reminders
  ON appointments(confirmed_start)
  WHERE status = 'confirmed'
    AND (reminder_24h_sent = false OR reminder_1h_sent = false);


-- ============================================================
-- 15. DOCUMENTS (agent library)
-- ============================================================

CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255)  NOT NULL,
  description       TEXT,
  file_url          TEXT          NOT NULL,
  file_name         VARCHAR(255)  NOT NULL,
  file_size_bytes   INT,
  file_type         VARCHAR(20),  -- 'pdf', 'docx', 'jpg', etc.

  category          VARCHAR(50)   DEFAULT 'Other'
                    CHECK (category IN (
                      'Buyer Resources',
                      'Seller Resources',
                      'Market Reports',
                      'Property Documents',
                      'Disclosures',
                      'Other'
                    )),

  is_public         BOOLEAN       DEFAULT false,
  -- Public documents appear on the website as downloadable resources

  uploaded_at       TIMESTAMPTZ   DEFAULT now(),
  updated_at        TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_documents_category  ON documents(category);
CREATE INDEX idx_documents_public    ON documents(is_public) WHERE is_public = true;


-- ============================================================
-- 16. BLOG POSTS
-- ============================================================
-- Editor: TipTap (WYSIWYG). Content stored as TipTap JSON (portable,
-- queryable). content_html is pre-rendered on save for fast public display.

CREATE TABLE blog_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(255)  NOT NULL,
  slug                VARCHAR(255)  UNIQUE NOT NULL,
  -- Auto-generated from title, agent can override

  excerpt             TEXT,
  -- 1–2 sentence summary for listing cards and social previews

  content             JSONB         NOT NULL,
  -- TipTap / ProseMirror JSON document format

  content_html        TEXT,
  -- Pre-rendered HTML, generated server-side on save
  -- Used for public display — avoids client-side rendering overhead

  cover_image_url     TEXT,
  cover_image_alt     TEXT,

  -- SEO (agent can override, auto-populated from title/excerpt if blank)
  meta_title          VARCHAR(255),
  meta_description    TEXT,

  tags                TEXT[]        DEFAULT '{}',
  -- e.g. ['Market Update', 'Buyer Tips', 'Columbia SC', 'Luxury']

  is_published        BOOLEAN       DEFAULT false,
  published_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ   DEFAULT now(),
  updated_at          TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_blog_posts_slug      ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(is_published, published_at DESC)
  WHERE is_published = true;
CREATE INDEX idx_blog_posts_tags      ON blog_posts USING GIN(tags);


-- ============================================================
-- 17. PUSH SUBSCRIPTIONS (Web Push API)
-- ============================================================

CREATE TABLE push_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint       TEXT          NOT NULL UNIQUE,
  p256dh_key     TEXT          NOT NULL,
  auth_key       TEXT          NOT NULL,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  last_used_at   TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);


-- ============================================================
-- 18. NOTIFICATIONS LOG
-- ============================================================
-- Every outbound notification is logged here regardless of channel.
-- Enables: unread counts, notification center in portal/dashboard,
-- delivery status tracking, and retry logic via BullMQ.

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type       VARCHAR(60)   NOT NULL,
  -- 'new_message' | 'new_chat' | 'appointment_confirmed' | 'appointment_reminder_24h'
  -- 'appointment_reminder_1h' | 'appointment_cancelled' | 'time_suggestion_received'
  -- 'time_suggestion_response' | 'new_listing_match' | 'document_shared'

  title      VARCHAR(255)  NOT NULL,
  body       TEXT,

  data       JSONB         DEFAULT '{}',
  -- Deep-link data for client routing
  -- e.g. { thread_id: '...', appointment_id: '...' }

  channel    VARCHAR(10)   NOT NULL CHECK (channel IN ('push', 'email', 'in_app')),

  status     VARCHAR(10)   DEFAULT 'pending'
             CHECK (status IN ('pending', 'sent', 'failed', 'read')),

  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX idx_notifications_unread    ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_pending   ON notifications(status, created_at) WHERE status = 'pending';


-- ============================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- auth.uid() = the currently authenticated Supabase user's UUID
-- agent_id()  = helper function that returns the single agent user's ID

-- Helper: identify the agent role (stored in users.role)
CREATE OR REPLACE FUNCTION is_agent()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'agent'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ---- markets ----
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active markets"
  ON markets FOR SELECT USING (is_active = true);
CREATE POLICY "Agent can manage markets"
  ON markets FOR ALL USING (is_agent());

-- ---- listings ----
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active listings"
  ON listings FOR SELECT USING (mls_status = 'Active');
CREATE POLICY "Agent can view all listings"
  ON listings FOR SELECT USING (is_agent());
-- Sync job uses service role key — bypasses RLS

-- ---- listing_overrides ----
ALTER TABLE listing_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view non-hidden overrides"
  ON listing_overrides FOR SELECT USING (is_hidden = false);
CREATE POLICY "Agent can manage overrides"
  ON listing_overrides FOR ALL USING (is_agent());

-- ---- manual_listings ----
ALTER TABLE manual_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active manual listings"
  ON manual_listings FOR SELECT USING (is_active = true AND status = 'Active');
CREATE POLICY "Agent can manage manual listings"
  ON manual_listings FOR ALL USING (is_agent());

-- ---- users ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Agent can view all users"
  ON users FOR SELECT USING (is_agent());

-- ---- leads ----
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage all leads"
  ON leads FOR ALL USING (is_agent());
-- Clients never directly access the leads table

-- ---- saved_properties ----
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved properties"
  ON saved_properties FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Agent can view all saved properties"
  ON saved_properties FOR SELECT USING (is_agent());

-- ---- saved_searches ----
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved searches"
  ON saved_searches FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Agent can view all saved searches"
  ON saved_searches FOR SELECT USING (is_agent());

-- ---- threads ----
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can view own threads"
  ON threads FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Agent can view all threads"
  ON threads FOR ALL USING (is_agent());

-- ---- messages ----
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread participants can view messages"
  ON messages FOR SELECT USING (
    is_agent()
    OR EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = messages.thread_id
        AND threads.client_id = auth.uid()
    )
  );
CREATE POLICY "Thread participants can send messages"
  ON messages FOR INSERT WITH CHECK (
    is_agent()
    OR EXISTS (
      SELECT 1 FROM threads
      WHERE threads.id = messages.thread_id
        AND threads.client_id = auth.uid()
    )
  );

-- ---- chat_sessions ----
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage all chat sessions"
  ON chat_sessions FOR ALL USING (is_agent());
-- Chat sessions accessed via service role in API for guest users

-- ---- appointments ----
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can view own appointments"
  ON appointments FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients can create appointments"
  ON appointments FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Agent can manage all appointments"
  ON appointments FOR ALL USING (is_agent());

-- ---- documents ----
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view public documents"
  ON documents FOR SELECT USING (is_public = true);
CREATE POLICY "Agent can manage all documents"
  ON documents FOR ALL USING (is_agent());

-- ---- blog_posts ----
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published posts"
  ON blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "Agent can manage all posts"
  ON blog_posts FOR ALL USING (is_agent());

-- ---- push_subscriptions ----
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL USING (user_id = auth.uid());

-- ---- notifications ----
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Agent can view all notifications"
  ON notifications FOR SELECT USING (is_agent());


-- ============================================================
-- 19. SYNC LOGS
-- ============================================================
-- Every MLS sync run is recorded here regardless of outcome.
-- Displayed in the agent dashboard Markets section.

CREATE TABLE sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id         UUID          NOT NULL REFERENCES markets(id) ON DELETE CASCADE,

  sync_type         VARCHAR(20)   NOT NULL
                    CHECK (sync_type IN ('full', 'incremental', 'stale_check')),

  status            VARCHAR(25)   DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),

  new_listings      INT           DEFAULT 0,
  updated_listings  INT           DEFAULT 0,
  removed_listings  INT           DEFAULT 0,
  error_count       INT           DEFAULT 0,
  error_details     JSONB         DEFAULT '[]',
  -- [{mls_id: string, error: string}]

  started_at        TIMESTAMPTZ   DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  duration_ms       INT
);

CREATE INDEX idx_sync_logs_market_id   ON sync_logs(market_id);
CREATE INDEX idx_sync_logs_started_at  ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status      ON sync_logs(status);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can view all sync logs"
  ON sync_logs FOR SELECT USING (is_agent());


-- ============================================================
-- UTILITY VIEWS
-- ============================================================

-- Unified listing view: merges MLS listings + overrides into a single shape
-- for the API layer to query. Excludes hidden listings.
CREATE OR REPLACE VIEW v_listings AS
SELECT
  l.id,
  l.mls_id,
  l.mls_source,
  l.state,
  l.region,
  l.address,
  l.city,
  l.county,
  l.zip,
  l.lat,
  l.lng,
  l.price,
  l.beds,
  l.baths,
  l.half_baths,
  l.sqft,
  l.lot_size,
  l.lot_unit,
  l.year_built,
  l.property_type,
  l.mls_status        AS status,
  l.description,
  CASE
    WHEN o.extra_photos IS NOT NULL AND jsonb_array_length(o.extra_photos) > 0
    THEN l.photos || o.extra_photos
    ELSE l.photos
  END                 AS photos,
  l.features,
  COALESCE(o.custom_headline, NULL) AS custom_headline,
  COALESCE(o.highlight_tags, '{}')  AS highlight_tags,
  COALESCE(o.is_featured, false)    AS is_featured,
  false                             AS is_starred,   -- MLS listings don't use starred
  'mls'                             AS listing_source,
  o.extra_documents,
  l.listing_agent_name,
  l.listing_office_name,
  l.listed_at,
  l.updated_at
FROM listings l
LEFT JOIN listing_overrides o ON o.listing_id = l.id
WHERE l.mls_status = 'Active'
  AND COALESCE(o.is_hidden, false) = false

UNION ALL

SELECT
  m.id,
  NULL              AS mls_id,
  'manual'          AS mls_source,
  m.state,
  NULL              AS region,
  m.address,
  m.city,
  m.county,
  m.zip,
  m.lat,
  m.lng,
  m.price,
  m.beds,
  m.baths,
  m.half_baths,
  m.sqft,
  m.lot_size,
  m.lot_unit,
  m.year_built,
  m.property_type,
  m.status,
  m.description,
  m.photos,
  m.features,
  m.custom_headline,
  m.highlight_tags,
  m.is_featured,
  m.is_starred,
  'manual'          AS listing_source,
  m.documents       AS extra_documents,
  NULL              AS listing_agent_name,
  NULL              AS listing_office_name,
  NULL              AS listed_at,
  m.updated_at
FROM manual_listings m
WHERE m.is_active = true AND m.status = 'Active';


-- ============================================================
-- END OF SCHEMA
-- ============================================================
