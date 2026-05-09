import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { ProviderRegistry } from '../../providers/ProviderRegistry';
import { normalizeMlsStatus } from './normalizer';

export interface StaleCheckJobData {
  mls_id: string;
  market_id: string;
  triggered_by: 'full_sync' | 'scheduled';
}

/**
 * staleCheckHandler
 *
 * Verifies the current status of a single listing by calling
 * provider.fetchById(). Used after a full sync detects listings
 * that weren't in the IDX feed, and on the scheduled 2-hour check.
 *
 * If the listing is no longer Active, updates our DB and queues
 * user notifications.
 *
 * BullMQ queue: 'mls-stale-check'
 * Concurrency: 5
 * Timeout: 30 seconds per listing
 */
export async function staleCheckHandler(job: Job<StaleCheckJobData>): Promise<void> {
  const { mls_id, market_id } = job.data;

  // -------------------------------------------------------------------------
  // 1. Load listing from our DB
  // -------------------------------------------------------------------------
  const { data: listing } = await db
    .from('listings')
    .select('id, mls_id, mls_source, mls_status, address, city, state, market_id')
    .eq('mls_id', mls_id)
    .eq('market_id', market_id)
    .single();

  if (!listing) return; // Already removed or never existed — nothing to do

  if (listing.mls_status !== 'Active') return; // Already non-active — skip

  // -------------------------------------------------------------------------
  // 2. Load market and provider
  // -------------------------------------------------------------------------
  const { data: market } = await db
    .from('markets')
    .select('provider_class')
    .eq('id', market_id)
    .single();

  if (!market) return;

  const provider = ProviderRegistry.getProvider(market.provider_class);

  // -------------------------------------------------------------------------
  // 3. Fetch current status from IDX
  // -------------------------------------------------------------------------
  const currentListing = await provider.fetchById(mls_id);

  let newStatus: string;

  if (!currentListing) {
    // Listing removed from IDX feed entirely → treat as Withdrawn
    newStatus = 'Withdrawn';
  } else {
    newStatus = normalizeMlsStatus(currentListing.StandardStatus);
  }

  // -------------------------------------------------------------------------
  // 4. If status changed, update DB and queue notification
  // -------------------------------------------------------------------------
  if (newStatus !== 'Active') {
    await db
      .from('listings')
      .update({
        mls_status: newStatus,
        synced_at:  new Date().toISOString(),
      })
      .eq('id', listing.id);

    const { listingStatusChangedQueue } = await import('./scheduler');

    await listingStatusChangedQueue.add('listing-status-changed', {
      listing_id:  listing.id,
      old_status:  'Active',
      new_status:  newStatus,
      address:     listing.address,
      city:        listing.city,
      state:       listing.state,
    }, { attempts: 3, removeOnComplete: true });

    console.log(
      `[staleCheck] ${listing.address}, ${listing.city} — ` +
      `status changed Active → ${newStatus}`
    );
  }
}

/**
 * scheduledStaleCheckHandler
 *
 * Runs on the 2-hour schedule. Finds all listings that haven't been
 * refreshed (synced_at) in over 26 hours and queues individual stale checks.
 *
 * BullMQ queue: 'mls-stale-check-batch'
 * Runs once, queues N individual staleCheckHandler jobs.
 */
export async function scheduledStaleCheckHandler(
  job: Job<{ market_id: string }>
): Promise<void> {
  const { market_id } = job.data;

  const staleThreshold = new Date(Date.now() - 26 * 60 * 60 * 1000); // 26 hours ago

  const { data: staleListings } = await db
    .from('listings')
    .select('mls_id')
    .eq('market_id', market_id)
    .eq('mls_status', 'Active')
    .lt('synced_at', staleThreshold.toISOString());

  if (!staleListings || staleListings.length === 0) return;

  const { staleCheckQueue } = await import('./scheduler');

  const jobs = staleListings.map((l) => ({
    name: 'stale-check-listing',
    data: { mls_id: l.mls_id, market_id, triggered_by: 'scheduled' as const },
    opts: { attempts: 2, removeOnComplete: true },
  }));

  for (let i = 0; i < jobs.length; i += 50) {
    await staleCheckQueue.addBulk(jobs.slice(i, i + 50));
  }

  console.log(
    `[scheduledStaleCheck] Queued ${staleListings.length} stale checks for market ${market_id}`
  );
}

// Re-export for use in normalizer (avoids circular import by keeping it here)
export { normalizeMlsStatus };
