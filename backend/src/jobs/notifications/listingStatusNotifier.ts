import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../lib/db';
import { createNotification } from './notificationWorker';

/**
 * listingStatusNotifier.ts
 *
 * Handles the 'mls-listing-status-changed' queue.
 * Queued by both incrementalSync and staleCheck when a listing
 * transitions away from Active status.
 *
 * Responsibilities:
 *   1. Notify users who saved this property
 *   2. Notify users whose saved searches would have matched this listing
 *      (so they know a potential match is gone)
 */

export interface ListingStatusChangedJobData {
  listing_id:  string;
  old_status:  string;
  new_status:  string;
  address:     string;
  city:        string;
  state:       string;
}

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const listingStatusNotifierWorker = new Worker(
  'mls-listing-status-changed',
  listingStatusChangedHandler,
  { connection, concurrency: 5 },
);

// -------------------------------------------------------------------------
// listingStatusChangedHandler
// -------------------------------------------------------------------------

async function listingStatusChangedHandler(
  job: Job<ListingStatusChangedJobData>
): Promise<void> {
  const { listing_id, old_status, new_status, address, city, state } = job.data;

  if (old_status === new_status) return; // No actual change

  const displayAddress = `${address}, ${city}, ${state}`;
  const statusLabel    = buildStatusLabel(new_status);

  await Promise.all([
    notifySavedPropertyUsers(listing_id, displayAddress, statusLabel, new_status),
    notifySavedSearchUsers(listing_id, displayAddress, new_status),
  ]);
}

// -------------------------------------------------------------------------
// Notify users who explicitly saved this property
// -------------------------------------------------------------------------

async function notifySavedPropertyUsers(
  listingId:      string,
  displayAddress: string,
  statusLabel:    string,
  newStatus:      string,
): Promise<void> {
  const { data: saves } = await db
    .from('saved_properties')
    .select('user_id')
    .eq('listing_id', listingId)
    .eq('listing_type', 'mls');

  if (!saves || saves.length === 0) return;

  const { title, body } = buildSavedPropertyMessage(displayAddress, statusLabel, newStatus);

  const notifyPromises = saves.map((s) =>
    createNotification(
      s.user_id,
      'listing_status_changed',
      title,
      body,
      {
        listing_id:  listingId,
        new_status:  newStatus,
      },
    )
  );

  await Promise.allSettled(notifyPromises);
  console.log(`[listingStatusNotifier] Notified ${saves.length} users who saved ${displayAddress}`);
}

// -------------------------------------------------------------------------
// Notify users whose saved searches previously matched this listing
//
// Fetch the full listing from DB (may still have Active status at this point
// before it's updated, which is fine — we just need its field values for matching).
// -------------------------------------------------------------------------

async function notifySavedSearchUsers(
  listingId:      string,
  displayAddress: string,
  newStatus:      string,
): Promise<void> {
  // Only worth notifying for high-interest status changes
  if (!['Sold', 'Pending'].includes(newStatus)) return;

  const { data: listing } = await db
    .from('listings')
    .select('state, city, zip, price, beds, baths, sqft, property_type, description, address')
    .eq('id', listingId)
    .single();

  if (!listing) return;

  const { data: savedSearches } = await db
    .from('saved_searches')
    .select('id, user_id, name, filters')
    .eq('notify_on_new_match', true);

  if (!savedSearches || savedSearches.length === 0) return;

  // Import matcher (avoids circular dep — both files import from notificationWorker)
  const { listingMatchesSearch } = await import('./savedSearchMatcher');

  const matchingSearches = savedSearches.filter((s) =>
    listingMatchesSearch(listing, s.filters)
  );

  if (matchingSearches.length === 0) return;

  const statusLabel = newStatus === 'Sold' ? 'sold' : 'gone pending';
  const notifyPromises = matchingSearches.map((s) =>
    createNotification(
      s.user_id,
      'listing_status_changed',
      `A match for "${s.name}" is ${statusLabel}`,
      `${displayAddress} has gone ${statusLabel}.`,
      {
        listing_id:      listingId,
        saved_search_id: s.id,
        new_status:      newStatus,
      },
    )
  );

  await Promise.allSettled(notifyPromises);
}

// -------------------------------------------------------------------------
// Message builders
// -------------------------------------------------------------------------

function buildStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    Sold:               'sold',
    Pending:            'under contract',
    Withdrawn:          'removed from the market',
    Expired:            'expired',
    'Coming Soon':      'coming soon',
    'Active Under Contract': 'under contract',
  };
  return labels[status] ?? status.toLowerCase();
}

function buildSavedPropertyMessage(
  displayAddress: string,
  statusLabel:    string,
  newStatus:      string,
): { title: string; body: string } {
  const isSold    = newStatus === 'Sold';
  const isPending = newStatus === 'Pending' || newStatus === 'Active Under Contract';

  if (isSold) {
    return {
      title: 'A home you saved has sold',
      body:  `${displayAddress} has sold.`,
    };
  }

  if (isPending) {
    return {
      title: 'A home you saved is under contract',
      body:  `${displayAddress} is now under contract. Similar homes may still be available.`,
    };
  }

  return {
    title: 'Update on a saved home',
    body:  `${displayAddress} is now ${statusLabel}.`,
  };
}
