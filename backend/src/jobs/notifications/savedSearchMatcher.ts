import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../lib/db';
import { createNotification } from './notificationWorker';
import { InternalListing } from '../../types/listing';

/**
 * savedSearchMatcher.ts
 *
 * After every MLS sync run, newly added listings are matched against
 * all active saved searches. Users with a match get a push notification.
 *
 * Key design: matches are GROUPED per (user, saved_search) per sync run.
 * If 20 new listings match the same search, the user gets ONE notification
 * ("20 new matches for 'Columbia 3BR'"), not 20 separate pings.
 *
 * BullMQ queue: 'saved-search-match'
 * Job data: { market_id, new_listing_ids[] }
 * Queued by: fullSync and incrementalSync workers after each run
 */

interface SavedSearchFilters {
  states?:         string[];
  cities?:         string[];
  min_price?:      number;
  max_price?:      number;
  min_beds?:       number;
  min_baths?:      number;
  property_types?: string[];
  min_sqft?:       number;
  max_sqft?:       number;
  keywords?:       string;
}

interface SavedSearchMatchJobData {
  market_id:       string;
  new_listing_ids: string[]; // UUIDs of newly inserted listings
}

// -------------------------------------------------------------------------
// Queue & Worker
// -------------------------------------------------------------------------

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const savedSearchMatchQueue = new Queue('saved-search-match', {
  connection,
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: 'fixed', delay: 30_000 },
    removeOnComplete: { count: 50 },
  },
});

export const savedSearchMatchWorker = new Worker(
  'saved-search-match',
  matchHandler,
  { connection, concurrency: 2 },
);

// -------------------------------------------------------------------------
// matchHandler
// -------------------------------------------------------------------------

async function matchHandler(job: Job<SavedSearchMatchJobData>): Promise<void> {
  const { new_listing_ids } = job.data;

  if (!new_listing_ids || new_listing_ids.length === 0) return;

  // 1. Fetch the new listings
  const { data: listings } = await db
    .from('listings')
    .select('id, state, city, zip, price, beds, baths, sqft, property_type, description, address')
    .in('id', new_listing_ids)
    .eq('mls_status', 'Active');

  if (!listings || listings.length === 0) return;

  // 2. Fetch all saved searches that want notifications
  const { data: savedSearches } = await db
    .from('saved_searches')
    .select('id, user_id, name, filters')
    .eq('notify_on_new_match', true);

  if (!savedSearches || savedSearches.length === 0) return;

  // 3. Match listings against each saved search
  // Group matches: Map<`${userId}:${searchId}`, { search, matches: listing[] }>
  const matchGroups = new Map<string, {
    userId:     string;
    searchId:   string;
    searchName: string;
    matches:    typeof listings;
  }>();

  for (const search of savedSearches) {
    const filters = search.filters as SavedSearchFilters;
    const matchingListings = listings.filter((l) => listingMatchesSearch(l, filters));

    if (matchingListings.length === 0) continue;

    const key = `${search.user_id}:${search.id}`;
    matchGroups.set(key, {
      userId:     search.user_id,
      searchId:   search.id,
      searchName: search.name,
      matches:    matchingListings,
    });
  }

  if (matchGroups.size === 0) return;

  // 4. Create one notification per (user, saved_search) group
  const notifyPromises: Promise<void>[] = [];

  for (const group of matchGroups.values()) {
    const count   = group.matches.length;
    const first   = group.matches[0];
    const title   = count === 1
      ? `New match for "${group.searchName}"`
      : `${count} new matches for "${group.searchName}"`;
    const body    = count === 1
      ? `${first.address}, ${first.city} — $${formatPrice(first.price)}`
      : `${first.address} and ${count - 1} more in ${first.city}`;

    notifyPromises.push(
      createNotification(
        group.userId,
        'new_listing_match',
        title,
        body,
        {
          saved_search_id: group.searchId,
          listing_id:      first.id,
          match_count:     String(count),
        },
      )
    );
  }

  await Promise.allSettled(notifyPromises);

  // 5. Update last_checked_at on all matched searches
  const checkedSearchIds = [...new Set([...matchGroups.values()].map((g) => g.searchId))];
  await db
    .from('saved_searches')
    .update({ last_checked_at: new Date().toISOString() })
    .in('id', checkedSearchIds);

  console.log(
    `[savedSearchMatcher] ${new_listing_ids.length} new listings → ` +
    `${matchGroups.size} search matches → notifications queued`
  );
}

// -------------------------------------------------------------------------
// listingMatchesSearch
//
// Pure function — easy to unit test.
// Checks filters from cheapest to most expensive.
// Short-circuits on first failure.
// -------------------------------------------------------------------------

export function listingMatchesSearch(
  listing: Record<string, any>,
  filters: SavedSearchFilters,
): boolean {
  // 1. State (cheapest — array lookup)
  if (filters.states && filters.states.length > 0) {
    if (!filters.states.includes(listing.state)) return false;
  }

  // 2. Property type
  if (filters.property_types && filters.property_types.length > 0) {
    if (!filters.property_types.includes(listing.property_type)) return false;
  }

  // 3. Price range
  if (filters.min_price != null && (listing.price == null || listing.price < filters.min_price)) {
    return false;
  }
  if (filters.max_price != null && (listing.price == null || listing.price > filters.max_price)) {
    return false;
  }

  // 4. Beds / baths
  if (filters.min_beds != null && (listing.beds == null || listing.beds < filters.min_beds)) {
    return false;
  }
  if (filters.min_baths != null && (listing.baths == null || listing.baths < filters.min_baths)) {
    return false;
  }

  // 5. City (case-insensitive)
  if (filters.cities && filters.cities.length > 0) {
    const listingCity = (listing.city ?? '').toLowerCase();
    const match = filters.cities.some((c) => listingCity.includes(c.toLowerCase()));
    if (!match) return false;
  }

  // 6. Square footage
  if (filters.min_sqft != null && (listing.sqft == null || listing.sqft < filters.min_sqft)) {
    return false;
  }
  if (filters.max_sqft != null && (listing.sqft == null || listing.sqft > filters.max_sqft)) {
    return false;
  }

  // 7. Keywords — most expensive, checked last
  if (filters.keywords) {
    const text = `${listing.description ?? ''} ${listing.address ?? ''} ${listing.city ?? ''}`.toLowerCase();
    const words = filters.keywords.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every((word) => text.includes(word))) return false;
  }

  return true;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function formatPrice(price: number | null): string {
  if (price == null) return 'N/A';
  return price >= 1_000_000
    ? `${(price / 1_000_000).toFixed(1)}M`
    : `${Math.round(price / 1000)}k`;
}
