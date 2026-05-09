import { RESOListing } from '../types/reso';

/**
 * ListingProvider — abstract interface every MLS connection must implement.
 *
 * The sync jobs are written against this interface only.
 * They have no knowledge of which MLS, aggregator, or API format is behind it.
 *
 * Adding a new state = create a new class implementing this interface.
 * No changes to sync job code required.
 */
export interface ListingProvider {
  /**
   * The UUID of the corresponding row in the `markets` table.
   * Used by sync jobs to update last_synced_at and write sync_logs.
   */
  getMarketId(): string;

  /**
   * The human-readable MLS source identifier.
   * Stored on every listing: e.g. 'CMLS', 'FMLS', 'Stellar'
   */
  getMlsSource(): string;

  /**
   * Async generator that yields pages of all active listings.
   * The sync job iterates pages and upserts each batch.
   *
   * Yields arrays (pages) rather than individual listings so the caller
   * can batch DB writes efficiently.
   *
   * @param pageSize - Number of listings per page (default: 100)
   */
  fetchAll(pageSize?: number): AsyncGenerator<RESOListing[]>;

  /**
   * Async generator that yields pages of listings modified after `since`.
   * Uses the RESO ModificationTimestamp filter.
   * Used for incremental syncs.
   *
   * @param since - Only return listings modified after this date
   * @param pageSize - Number of listings per page (default: 100)
   */
  fetchModifiedSince(since: Date, pageSize?: number): AsyncGenerator<RESOListing[]>;

  /**
   * Fetch a single listing by its MLS ID.
   * Used by the stale check job to verify current status.
   * Returns null if the listing is no longer in the feed (treat as Withdrawn).
   */
  fetchById(mlsId: string): Promise<RESOListing | null>;

  /**
   * Ping the IDX provider to verify credentials and connectivity.
   * Used on startup and in the dashboard Markets health check.
   */
  testConnection(): Promise<boolean>;
}
