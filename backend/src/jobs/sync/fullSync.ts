import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { ProviderRegistry } from '../../providers/ProviderRegistry';
import { normalizeRESOListing } from './normalizer';
import { InternalListing, SyncStats, UpsertResult } from '../../types/listing';

const UPSERT_BATCH_SIZE = 100;

export interface FullSyncJobData {
  market_id: string;
}

/**
 * fullSync
 *
 * Fetches ALL active listings from the IDX provider and upserts them.
 * After all pages are processed, detects listings that were in our DB
 * but NOT seen in this sync (potential stale/removed listings).
 *
 * BullMQ queue: 'mls-sync-full'
 * Concurrency: 1 per market (enforced by job ID: `full-sync-{market_id}`)
 * Timeout: 30 minutes
 */
export async function fullSyncHandler(job: Job<FullSyncJobData>): Promise<SyncStats> {
  const { market_id } = job.data;
  const startedAt = Date.now();

  // -------------------------------------------------------------------------
  // 1. Load market and get provider
  // -------------------------------------------------------------------------
  const { data: market, error: marketError } = await db
    .from('markets')
    .select('*')
    .eq('id', market_id)
    .single();

  if (marketError || !market) {
    throw new Error(`Market not found: ${market_id}`);
  }

  const provider = ProviderRegistry.getProvider(market.provider_class);

  // -------------------------------------------------------------------------
  // 2. Create sync log entry
  // -------------------------------------------------------------------------
  const { data: syncLog } = await db
    .from('sync_logs')
    .insert({
      market_id,
      sync_type: 'full',
      status: 'running',
    })
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

  // Track every mls_id we see in this full sync
  const seenMlsIds = new Set<string>();

  try {
    // -------------------------------------------------------------------------
    // 3. Fetch all pages and upsert
    // -------------------------------------------------------------------------
    let pageIndex = 0;

    for await (const page of provider.fetchAll(UPSERT_BATCH_SIZE)) {
      pageIndex++;
      await job.updateProgress(Math.min(pageIndex * 2, 80)); // rough progress

      const normalized: InternalListing[] = [];

      for (const raw of page) {
        try {
          const listing = normalizeRESOListing(raw, market_id);
          normalized.push(listing);
          seenMlsIds.add(raw.ListingKey);
        } catch (err) {
          stats.error_count++;
          stats.error_details.push({
            mls_id: raw.ListingKey ?? 'unknown',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (normalized.length > 0) {
        const result = await upsertListings(normalized);
        stats.new_listings     += result.inserted;
        stats.updated_listings += result.updated;
        stats.error_count      += result.errors.length;
        stats.error_details.push(...result.errors);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Stale detection — listings in our DB not seen in this full sync
    // -------------------------------------------------------------------------
    await job.updateProgress(85);

    if (seenMlsIds.size > 0) {
      const potentiallyStale = await findStaleListings(market_id, seenMlsIds);

      if (potentiallyStale.length > 0) {
        // Queue individual stale checks for each — they will call provider.fetchById()
        // to confirm current status before changing anything in our DB.
        await queueStaleChecks(potentiallyStale, market_id);
        console.log(
          `[fullSync] Queued ${potentiallyStale.length} stale checks for market ${market.mls_name}`
        );
      }
    }

    // -------------------------------------------------------------------------
    // 5. Update market last_synced_at
    // -------------------------------------------------------------------------
    await job.updateProgress(95);

    await db
      .from('markets')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', market_id);

    // -------------------------------------------------------------------------
    // 6. Finalize sync log
    // -------------------------------------------------------------------------
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

    await job.updateProgress(100);

    console.log(
      `[fullSync] ${market.mls_name} complete — ` +
      `new: ${stats.new_listings}, updated: ${stats.updated_listings}, ` +
      `errors: ${stats.error_count}, duration: ${stats.duration_ms}ms`
    );

    // 7. Notify agent via Socket.io (emitted from the job queue event handler in server.ts)
    return stats;

  } catch (err) {
    // Mark sync log as failed
    await db.from('sync_logs').update({
      status:       'failed',
      error_count:  1,
      error_details: [{ mls_id: 'N/A', error: String(err) }],
      completed_at: new Date().toISOString(),
      duration_ms:  Date.now() - startedAt,
    }).eq('id', syncLogId);

    throw err; // BullMQ will retry per job options
  }
}

// -----------------------------------------------------------------------------
// Bulk upsert helper
// -----------------------------------------------------------------------------

async function upsertListings(listings: InternalListing[]): Promise<UpsertResult> {
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
    // PostGIS point — computed column or set via trigger in Supabase
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

  // Supabase upsert: conflict on (mls_id, mls_source) → update all columns except id/created_at
  const { data, error } = await db
    .from('listings')
    .upsert(rows, { onConflict: 'mls_id,mls_source', ignoreDuplicates: false })
    .select('id, created_at');

  if (error) throw new Error(`Upsert failed: ${error.message}`);

  // Supabase doesn't tell us which rows were inserted vs updated in bulk upsert.
  // We approximate: rows where created_at = synced_at are new inserts.
  const now = Date.now();
  const inserted = (data ?? []).filter(
    (r) => Math.abs(new Date(r.created_at).getTime() - now) < 5000
  ).length;

  return {
    inserted,
    updated: rows.length - inserted,
    errors: [],
  };
}

// -----------------------------------------------------------------------------
// Stale detection helpers
// -----------------------------------------------------------------------------

async function findStaleListings(
  marketId: string,
  seenMlsIds: Set<string>,
): Promise<string[]> {
  // Fetch all mls_ids we have in the DB for this market that are currently Active
  const { data } = await db
    .from('listings')
    .select('mls_id')
    .eq('market_id', marketId)
    .eq('mls_status', 'Active');

  if (!data) return [];

  return data
    .map((r) => r.mls_id as string)
    .filter((mlsId) => !seenMlsIds.has(mlsId));
}

async function queueStaleChecks(mlsIds: string[], marketId: string): Promise<void> {
  // Import here to avoid circular dependency
  const { staleCheckQueue } = await import('./scheduler');

  const jobs = mlsIds.map((mls_id) => ({
    name: 'stale-check-listing',
    data: { mls_id, market_id: marketId, triggered_by: 'full_sync' },
    opts: { attempts: 2, removeOnComplete: true },
  }));

  // Add in batches of 50 to avoid overwhelming the queue
  for (let i = 0; i < jobs.length; i += 50) {
    await staleCheckQueue.addBulk(jobs.slice(i, i + 50));
  }
}
