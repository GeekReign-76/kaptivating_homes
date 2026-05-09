import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { ProviderRegistry } from '../../providers/ProviderRegistry';
import { normalizeRESOListing } from './normalizer';
import { InternalListing, MlsStatus, SyncStats } from '../../types/listing';
import { RESOListing } from '../../types/reso';

const UPSERT_BATCH_SIZE = 100;

export interface IncrementalSyncJobData {
  market_id: string;
}

/**
 * incrementalSync
 *
 * Fetches only listings modified since last_synced_at.
 * Much faster than full sync — typically 1-5% of total listings.
 *
 * Key responsibility beyond upsert: detect STATUS CHANGES.
 * If a listing was Active in our DB but is now Sold/Withdrawn/etc.,
 * queue a status-change notification job so affected users are alerted.
 *
 * BullMQ queue: 'mls-sync-incremental'
 * Concurrency: 3 (multiple markets can sync in parallel)
 * Timeout: 10 minutes
 */
export async function incrementalSyncHandler(
  job: Job<IncrementalSyncJobData>
): Promise<SyncStats> {
  const { market_id } = job.data;
  const startedAt = Date.now();

  // -------------------------------------------------------------------------
  // 1. Load market
  // -------------------------------------------------------------------------
  const { data: market, error: marketError } = await db
    .from('markets')
    .select('*')
    .eq('id', market_id)
    .single();

  if (marketError || !market) {
    throw new Error(`Market not found: ${market_id}`);
  }

  const since = market.last_synced_at
    ? new Date(market.last_synced_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: last 24 hours

  const provider = ProviderRegistry.getProvider(market.provider_class);

  // -------------------------------------------------------------------------
  // 2. Create sync log
  // -------------------------------------------------------------------------
  const { data: syncLog } = await db
    .from('sync_logs')
    .insert({ market_id, sync_type: 'incremental', status: 'running' })
    .select('id')
    .single();

  const syncLogId = syncLog?.id;

  const stats: SyncStats = {
    new_listings: 0,
    updated_listings: 0,
    removed_listings: 0,
    error_count: 0,
    error_details: [],
    duration_ms: 0,
  };

  try {
    // -------------------------------------------------------------------------
    // 3. Fetch modified listings and upsert
    // -------------------------------------------------------------------------
    for await (const page of provider.fetchModifiedSince(since, UPSERT_BATCH_SIZE)) {
      const normalized: InternalListing[] = [];
      const statusCheckNeeded: Array<{ mlsId: string; newStatus: MlsStatus }> = [];

      for (const raw of page) {
        try {
          const listing = normalizeRESOListing(raw, market_id);
          normalized.push(listing);

          // Detect status changes — check against current DB status
          if (listing.mls_status !== 'Active') {
            statusCheckNeeded.push({ mlsId: listing.mls_id, newStatus: listing.mls_status });
          }
        } catch (err) {
          stats.error_count++;
          stats.error_details.push({
            mls_id: raw.ListingKey ?? 'unknown',
            error:  err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (normalized.length > 0) {
        await upsertListings(normalized);
        stats.updated_listings += normalized.length;
      }

      // Queue status-change notifications for any non-Active listings
      if (statusCheckNeeded.length > 0) {
        await processStatusChanges(statusCheckNeeded, market_id, stats);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Update last_synced_at and finalize
    // -------------------------------------------------------------------------
    await db
      .from('markets')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', market_id);

    stats.duration_ms = Date.now() - startedAt;

    const finalStatus = stats.error_count > 0 ? 'completed_with_errors' : 'completed';

    await db.from('sync_logs').update({
      status:           finalStatus,
      new_listings:     stats.new_listings,
      updated_listings: stats.updated_listings,
      removed_listings: stats.removed_listings,
      error_count:      stats.error_count,
      error_details:    stats.error_details,
      completed_at:     new Date().toISOString(),
      duration_ms:      stats.duration_ms,
    }).eq('id', syncLogId);

    console.log(
      `[incrementalSync] ${market.mls_name} — ` +
      `updated: ${stats.updated_listings}, removed: ${stats.removed_listings}, ` +
      `errors: ${stats.error_count}, duration: ${stats.duration_ms}ms`
    );

    return stats;

  } catch (err) {
    await db.from('sync_logs').update({
      status:       'failed',
      error_count:  1,
      error_details: [{ mls_id: 'N/A', error: String(err) }],
      completed_at: new Date().toISOString(),
      duration_ms:  Date.now() - startedAt,
    }).eq('id', syncLogId);

    throw err;
  }
}

// -----------------------------------------------------------------------------
// Upsert
// -----------------------------------------------------------------------------

async function upsertListings(listings: InternalListing[]): Promise<void> {
  const rows = listings.map((l) => ({
    mls_id:               l.mls_id,
    mls_source:           l.mls_source,
    market_id:            l.market_id,
    state:                l.state,
    region:               l.region,
    address:              l.address,
    city:                 l.city,
    county:               l.county,
    zip:                  l.zip,
    lat:                  l.lat,
    lng:                  l.lng,
    price:                l.price,
    beds:                 l.beds,
    baths:                l.baths,
    half_baths:           l.half_baths,
    sqft:                 l.sqft,
    lot_size:             l.lot_size,
    lot_unit:             l.lot_unit,
    year_built:           l.year_built,
    property_type:        l.property_type,
    mls_status:           l.mls_status,
    description:          l.description,
    photos:               l.photos,
    features:             l.features,
    listing_agent_name:   l.listing_agent_name,
    listing_agent_mlsid:  l.listing_agent_mlsid,
    listing_office_name:  l.listing_office_name,
    listing_office_mlsid: l.listing_office_mlsid,
    listed_at:            l.listed_at?.toISOString() ?? null,
    price_changed_at:     l.price_changed_at?.toISOString() ?? null,
    synced_at:            new Date().toISOString(),
  }));

  const { error } = await db
    .from('listings')
    .upsert(rows, { onConflict: 'mls_id,mls_source', ignoreDuplicates: false });

  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

// -----------------------------------------------------------------------------
// Status change detection and notification queuing
// -----------------------------------------------------------------------------

async function processStatusChanges(
  changes: Array<{ mlsId: string; newStatus: MlsStatus }>,
  marketId: string,
  stats: SyncStats,
): Promise<void> {
  // Fetch current status of these listings from our DB
  const mlsIds = changes.map((c) => c.mlsId);

  const { data: existingListings } = await db
    .from('listings')
    .select('id, mls_id, mls_status, address, city, state')
    .eq('market_id', marketId)
    .in('mls_id', mlsIds);

  if (!existingListings || existingListings.length === 0) return;

  const { listingStatusChangedQueue } = await import('./scheduler');

  for (const change of changes) {
    const existing = existingListings.find((l) => l.mls_id === change.mlsId);
    if (!existing) continue;

    const wasActive = existing.mls_status === 'Active';
    const isNowInactive = change.newStatus !== 'Active';

    if (wasActive && isNowInactive) {
      stats.removed_listings++;

      // Queue notification job — handled separately from sync
      await listingStatusChangedQueue.add('listing-status-changed', {
        listing_id:  existing.id,
        old_status:  existing.mls_status,
        new_status:  change.newStatus,
        address:     existing.address,
        city:        existing.city,
        state:       existing.state,
      }, { attempts: 3, removeOnComplete: true });
    }
  }
}
