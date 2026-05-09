# MLS Sync System — Architecture & Design

**Last updated:** 2026-04-29

---

## Table of Contents

1. [Overview](#1-overview)
2. [ListingProvider Abstraction](#2-listingprovider-abstraction)
3. [RESO Web API & Data Source](#3-reso-web-api--data-source)
4. [Field Normalization](#4-field-normalization)
5. [Sync Modes](#5-sync-modes)
6. [Job Architecture (BullMQ)](#6-job-architecture-bullmq)
7. [Stale Listing Handling](#7-stale-listing-handling)
8. [Error Handling & Retry Logic](#8-error-handling--retry-logic)
9. [Sync Logging](#9-sync-logging)
10. [Adding a New State (GA / FL)](#10-adding-a-new-state-ga--fl)
11. [File Structure](#11-file-structure)

---

## 1. Overview

The MLS sync system is responsible for pulling listing data from IDX provider(s), normalizing it into our schema, and keeping the `listings` table up to date. The `listings` table is the only place MLS data is written — all application code reads from it.

**Key principles:**
- The `listings` table is **write-only from the sync job**. No API endpoint modifies it directly.
- Agent customizations live in `listing_overrides` — they are never touched by the sync job.
- Adding a new state requires **no code changes to the sync infrastructure** — only a new `ListingProvider` class and a row in the `markets` table.
- All sync runs are logged to `sync_logs`. Failures alert the agent.

---

## 2. ListingProvider Abstraction

Every MLS connection implements the same `ListingProvider` interface. The sync jobs call the interface — they have no knowledge of which MLS they're talking to.

```
ListingProvider (abstract interface)
  ├── getMarketId(): string
  ├── fetchAll(options): AsyncGenerator<RESOListing[]>
  ├── fetchModifiedSince(since: Date): AsyncGenerator<RESOListing[]>
  ├── fetchById(mlsId: string): Promise<RESOListing | null>
  └── testConnection(): Promise<boolean>

SCListingProvider   implements ListingProvider  ← SC/CMLS via Bridge Interactive
GAListingProvider   implements ListingProvider  ← GA/FMLS (future)
FLListingProvider   implements ListingProvider  ← FL/Stellar (future)
```

`ProviderRegistry` maps `market.provider_class` strings to provider instances. When the sync job reads the `markets` table, it looks up the right provider by class name.

---

## 3. RESO Web API & Data Source

**Standard:** RESO Web API 2.0 (OData-based)
**Aggregator:** Bridge Interactive (or Spark API — same RESO standard, different base URL)

### Authentication
Bridge Interactive uses OAuth 2.0 Client Credentials flow. Tokens expire every 24 hours. The provider handles token refresh transparently.

### Key RESO Fields We Use

| RESO Field | Our Column | Notes |
|---|---|---|
| `ListingKey` | `mls_id` | Primary identifier per MLS |
| `OriginatingSystemName` | `mls_source` | `'CMLS'`, `'FMLS'`, etc. |
| `ListPrice` | `price` | |
| `BedroomsTotal` | `beds` | |
| `BathroomsTotalDecimal` | `baths` | Decimal (2.5 = 2 full + 1 half) |
| `BathroomsHalf` | `half_baths` | |
| `LivingArea` | `sqft` | In sqft |
| `LotSizeArea` | `lot_size` | Unit from `LotSizeUnits` |
| `LotSizeUnits` | `lot_unit` | `'Square Feet'` → `'sqft'` |
| `YearBuilt` | `year_built` | |
| `PropertyType` | `property_type` | Normalized (see below) |
| `StandardStatus` | `mls_status` | |
| `PublicRemarks` | `description` | |
| `Media[]` | `photos` | Array of {url, order, caption} |
| `Latitude` | `lat` | |
| `Longitude` | `lng` | |
| `City` | `city` | |
| `CountyOrParish` | `county` | |
| `StateOrProvince` | `state` | `'SC'` |
| `PostalCode` | `zip` | |
| `ListAgentFullName` | `listing_agent_name` | IDX attribution |
| `ListOfficeName` | `listing_office_name` | IDX attribution |
| `ListAgentMlsId` | `listing_agent_mlsid` | |
| `ListOfficeMlsId` | `listing_office_mlsid` | |
| `ListingContractDate` | `listed_at` | |
| `PriceChangeTimestamp` | `price_changed_at` | |
| `ModificationTimestamp` | — | Used to filter incremental syncs |

### PropertyType Normalization

RESO `PropertyType` values vary by MLS. We normalize to a consistent set:

| RESO value(s) | Our value |
|---|---|
| `Residential`, `Single Family Residence` | `Single Family` |
| `Condominium`, `Condo` | `Condo` |
| `Townhouse`, `Townhome` | `Townhouse` |
| `Multi Family`, `MultiFamily`, `2-4 Units` | `Multi-Family` |
| `Land`, `Lots and Land`, `Vacant Land` | `Land` |
| `Commercial`, `Commercial Sale` | `Commercial` |
| anything else | `Other` |

---

## 4. Field Normalization

The `normalizer.ts` module is a pure function: `RESOListing → InternalListing`. It has no database or network calls — easy to unit test.

```
normalizeRESOListing(raw: RESOListing, marketId: string): InternalListing
```

Key normalization rules:
- Build full `address` from `StreetNumber + StreetName + StreetSuffix + UnitNumber`
- Convert `LotSizeUnits: 'Square Feet'` → `lot_unit: 'sqft'`, `'Acres'` → `'acres'`
- Convert RESO `StandardStatus` to our values (`'Active'`, `'Pending'`, `'Sold'`, `'Withdrawn'`, `'Expired'`, `'Coming Soon'`)
- Map `Media[]` to `[{url, order, caption}]` — filter out non-photo media categories
- Build PostGIS `geo` point from `lat`/`lng`
- Scrub any HTML from `PublicRemarks` (some MLSs include `<br>` tags)
- Strip `null` vs empty string inconsistencies (normalize to `null`)

---

## 5. Sync Modes

### Full Sync
- Pulls **all active listings** from the IDX provider
- No `ModificationTimestamp` filter — fetches everything
- Upserts every listing: `INSERT ... ON CONFLICT (mls_id, mls_source) DO UPDATE SET ...`
- After upsert, runs a **stale detection pass**: any listing in our DB for this market that was NOT seen in this full sync → mark as potentially stale → queue for status check
- **When it runs:** On first setup + every Sunday at 2am

### Incremental Sync
- Pulls only listings where `ModificationTimestamp >= last_synced_at`
- Much faster — typically 1–5% of the full dataset
- Same upsert logic as full sync
- Does NOT run stale detection (that's the full sync's job)
- **When it runs:** Every 12 hours (configurable per market in `markets.sync_interval_hours`)

### Stale Check
- Runs every 2 hours
- Queries our DB for listings in `Active` status that haven't been updated (`synced_at`) in over 26 hours
- For each: calls `provider.fetchById(mls_id)` to get current status from IDX
- If the IDX returns `Sold`, `Withdrawn`, `Expired`, etc. → updates our record + triggers user notifications
- If the IDX returns 404 (listing removed from feed) → marks as `Withdrawn`

---

## 6. Job Architecture (BullMQ)

### Queues

```
Queue: mls-sync-full          concurrency: 1 per market (never run 2 full syncs for same market)
Queue: mls-sync-incremental   concurrency: 3 (can run multiple markets in parallel)
Queue: mls-stale-check        concurrency: 5
Queue: mls-notifications      concurrency: 10 (fires user alerts after sync)
```

### Job Definitions

```
mls-sync-full
  data:    { market_id: string }
  options: { attempts: 3, backoff: { type: 'exponential', delay: 60000 } }
  timeout: 30 minutes

mls-sync-incremental
  data:    { market_id: string }
  options: { attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
  timeout: 10 minutes

mls-stale-check
  data:    { market_id: string }
  options: { attempts: 2, backoff: { type: 'fixed', delay: 60000 } }
  timeout: 5 minutes

mls-listing-status-changed
  data:    { listing_id: string, old_status: string, new_status: string }
  options: { attempts: 3 }
  timeout: 30 seconds
```

### Scheduler (BullMQ Scheduler)

```
Every 12 hours → add mls-sync-incremental for each active market
Every Sunday 2am → add mls-sync-full for each active market
Every 2 hours → add mls-stale-check for each active market
```

### Full Sync Flow

```
1. Load market from DB
2. Get provider from ProviderRegistry
3. Create sync_log record (status: 'running')
4. Fetch listings page by page via provider.fetchAll()
   - Each page: normalize → bulk upsert to DB (batch of 100)
   - Track: new_count, updated_count, seen_mls_ids[]
5. After all pages fetched:
   - Query DB for active listings in this market NOT in seen_mls_ids
   - Mark those as potentially stale → queue mls-stale-check jobs
6. Update markets.last_synced_at
7. Update sync_log (status: 'completed', stats)
8. Emit Socket.io sync_complete event to agent room
9. If any saved searches match new listings → queue mls-notifications jobs
```

### Incremental Sync Flow

```
1. Load market, get last_synced_at
2. Get provider → fetchModifiedSince(last_synced_at)
3. For each page of results:
   - Normalize → bulk upsert
   - Track status changes (was Active, now Sold → queue mls-listing-status-changed)
4. Update markets.last_synced_at = now()
5. Update sync_log
6. Emit Socket.io sync_complete to agent
7. Queue notifications for saved search matches
```

---

## 7. Stale Listing Handling

### What "stale" means
A listing in our DB with `mls_status = 'Active'` that has not been seen in a full sync OR has not been refreshed by the IDX feed in >26 hours.

### Status Change Cascade

When a listing transitions away from `Active`:

| Transition | Action |
|---|---|
| `Active → Pending` | Update status. Notify saved-property users: "A home you saved is now pending." |
| `Active → Sold` | Update status. Notify saved-property users: "A home you saved has sold." Remove from saved search future matches. |
| `Active → Withdrawn / Expired` | Update status. Notify saved-property users: "A listing you saved is no longer active." |
| Any → removed from feed (404) | Set `mls_status = 'Withdrawn'`. Same notifications as above. |

### Notification timing
Status change notifications are queued in `mls-notifications` queue, not sent inline. This keeps sync jobs fast and ensures notifications are retried independently if they fail.

---

## 8. Error Handling & Retry Logic

### Per-job retries
All sync jobs use BullMQ's built-in retry with exponential backoff:
- Attempt 1: immediate
- Attempt 2: 60 seconds later
- Attempt 3: 5 minutes later
- After 3 failures: job moves to dead-letter queue, agent alerted

### IDX provider errors
- `401 Unauthorized` → token refresh attempted, job retried
- `429 Rate Limited` → job delayed by `Retry-After` header value
- `503 Service Unavailable` → exponential backoff, alert if persistent
- Partial page failure → log which page failed, continue with remaining pages, flag sync as `completed_with_errors`

### Database errors
- Constraint violations on upsert: log the offending `mls_id`, skip that listing, continue
- Connection failures: retry entire job

### Agent alerts (on permanent failure)
- Push notification to agent: "MLS sync failed for [market]. Last successful sync: [time]."
- Email backup notification
- Dashboard shows a red sync status badge for the affected market

---

## 9. Sync Logging

A `sync_logs` table (added to schema):

```sql
CREATE TABLE sync_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id        UUID NOT NULL REFERENCES markets(id),
  sync_type        VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'stale_check')),
  status           VARCHAR(20) DEFAULT 'running'
                   CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
  new_listings     INT DEFAULT 0,
  updated_listings INT DEFAULT 0,
  removed_listings INT DEFAULT 0,    -- went non-active during this sync
  error_count      INT DEFAULT 0,
  error_details    JSONB DEFAULT '[]',
  started_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  duration_ms      INT
);
```

Dashboard "Markets" section shows the last 10 sync log entries per market with status badges.

---

## 10. Adding a New State (GA / FL)

When the agent is ready to add Georgia:

**Step 1 — Client action:** Sign IDX agreement with FMLS and/or GAMLS. Get API credentials from Bridge Interactive for those MLSs.

**Step 2 — Dev action:**
1. Create `GAListingProvider.ts` implementing `ListingProvider` (copy SCListingProvider, update base URL + credentials env vars)
2. Register it in `ProviderRegistry.ts` (one line)
3. Add env vars: `GA_IDX_CLIENT_ID`, `GA_IDX_CLIENT_SECRET`

**Step 3 — Database:**
```sql
INSERT INTO markets (state, mls_name, provider_class, is_active)
VALUES ('GA', 'First Multiple Listing Service (FMLS)', 'GAListingProvider', true);
```

**Step 4:** Agent toggles the GA market to active in the dashboard. The scheduler picks it up on the next tick and runs a full sync.

No other changes required.

---

## 11. File Structure

```
backend/src/
├── types/
│   ├── reso.ts              RESO Web API field types
│   └── listing.ts           Internal InternalListing type
├── providers/
│   ├── ListingProvider.ts   Abstract interface
│   ├── SCListingProvider.ts SC/CMLS via Bridge Interactive
│   └── ProviderRegistry.ts  Maps provider_class string → instance
├── jobs/sync/
│   ├── normalizer.ts        RESOListing → InternalListing (pure function)
│   ├── fullSync.ts          Full sync BullMQ job handler
│   ├── incrementalSync.ts   Incremental sync job handler
│   ├── staleCheck.ts        Stale listing detection job
│   └── scheduler.ts         BullMQ scheduler setup
└── lib/
    └── db.ts                Supabase client (service role)
```
