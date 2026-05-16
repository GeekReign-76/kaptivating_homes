import { Queue, Worker, RepeatableJob } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../lib/db';
import { fullSyncHandler } from './fullSync';
import { incrementalSyncHandler } from './incrementalSync';
import { staleCheckHandler, scheduledStaleCheckHandler } from './staleCheck';

// -------------------------------------------------------------------------
// Redis connection
// -------------------------------------------------------------------------

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck:     false,
});

// -------------------------------------------------------------------------
// Queue definitions
// -------------------------------------------------------------------------

export const fullSyncQueue = new Queue('mls-sync-full', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 100 },
  },
});

export const incrementalSyncQueue = new Queue('mls-sync-incremental', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 100 },
  },
});

export const staleCheckQueue = new Queue('mls-stale-check', {
  connection,
  defaultJobOptions: {
    attempts:  2,
    backoff:   { type: 'fixed', delay: 60_000 },
    removeOnComplete: true,
    removeOnFail:     { count: 50 },
  },
});

export const listingStatusChangedQueue = new Queue('mls-listing-status-changed', {
  connection,
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 100 },
  },
});

// -------------------------------------------------------------------------
// Workers
// -------------------------------------------------------------------------

const fullSyncWorker = new Worker(
  'mls-sync-full',
  fullSyncHandler,
  { connection, concurrency: 1 } // One full sync at a time globally
);

const incrementalSyncWorker = new Worker(
  'mls-sync-incremental',
  incrementalSyncHandler,
  { connection, concurrency: 3 } // Up to 3 markets syncing simultaneously
);

const staleCheckWorker = new Worker(
  'mls-stale-check',
  staleCheckHandler,
  { connection, concurrency: 5 }
);

// -------------------------------------------------------------------------
// Worker event handlers — emit Socket.io events and agent alerts
// -------------------------------------------------------------------------

fullSyncWorker.on('completed', async (job, result) => {
  console.log(`[fullSync] Job ${job.id} completed`, result);
  await emitSyncComplete(job.data.market_id, result);
});

fullSyncWorker.on('failed', async (job, err) => {
  console.error(`[fullSync] Job ${job?.id} failed after all retries:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await alertAgentSyncFailed(job.data.market_id, err.message);
  }
});

incrementalSyncWorker.on('completed', async (job, result) => {
  await emitSyncComplete(job.data.market_id, result);
});

incrementalSyncWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await alertAgentSyncFailed(job.data.market_id, err.message);
  }
});

// -------------------------------------------------------------------------
// Scheduler — registers recurring jobs
// -------------------------------------------------------------------------

/**
 * setupSyncScheduler
 *
 * Called once on server startup.
 * Loads all active markets from the DB and registers recurring sync jobs.
 * Safe to call multiple times — BullMQ deduplicates repeatable jobs by key.
 */
export async function setupSyncScheduler(): Promise<void> {
  const { data: markets } = await db
    .from('markets')
    .select('id, mls_name, sync_interval_hours')
    .eq('is_active', true);

  if (!markets || markets.length === 0) {
    console.log('[scheduler] No active markets found.');
    return;
  }

  for (const market of markets) {
    const intervalHours = market.sync_interval_hours ?? 12;

    // Incremental sync — every N hours
    await incrementalSyncQueue.add(
      `incremental-${market.id}`,
      { market_id: market.id },
      {
        repeat:  { every: intervalHours * 60 * 60 * 1000 },
        jobId:   `incremental-${market.id}`, // deduplicate
      }
    );

    // Full sync — every Sunday at 2am (cron expression)
    await fullSyncQueue.add(
      `full-${market.id}`,
      { market_id: market.id },
      {
        repeat: { pattern: '0 2 * * 0' }, // Sunday 2am UTC
        jobId:  `full-${market.id}`,
      }
    );

    // Stale check batch — every 2 hours
    await staleCheckQueue.add(
      `stale-batch-${market.id}`,
      { market_id: market.id },
      {
        repeat: { every: 2 * 60 * 60 * 1000 },
        jobId:  `stale-batch-${market.id}`,
      }
    );

    console.log(
      `[scheduler] Registered sync jobs for ${market.mls_name} ` +
      `(incremental: every ${intervalHours}h, full: weekly, stale: every 2h)`
    );
  }
}

/**
 * triggerFullSync
 *
 * Called from the API when agent clicks "Sync Now" in the dashboard.
 * Adds a one-off full sync job with high priority.
 */
export async function triggerFullSync(marketId: string): Promise<string> {
  const job = await fullSyncQueue.add(
    `manual-full-${marketId}-${Date.now()}`,
    { market_id: marketId },
    {
      priority: 1,             // High priority over scheduled jobs
      jobId: `manual-full-${marketId}-${Date.now()}`,
    }
  );
  return job.id!;
}

/**
 * onMarketActivated
 *
 * Called when the agent enables a new market in the dashboard.
 * Immediately triggers a full sync and registers recurring jobs.
 */
export async function onMarketActivated(marketId: string): Promise<void> {
  const { data: market } = await db
    .from('markets')
    .select('id, mls_name, sync_interval_hours')
    .eq('id', marketId)
    .single();

  if (!market) return;

  // Register recurring jobs for this market
  const intervalHours = market.sync_interval_hours ?? 12;

  await incrementalSyncQueue.add(
    `incremental-${marketId}`,
    { market_id: marketId },
    { repeat: { every: intervalHours * 60 * 60 * 1000 }, jobId: `incremental-${marketId}` }
  );

  await fullSyncQueue.add(
    `full-${marketId}`,
    { market_id: marketId },
    { repeat: { pattern: '0 2 * * 0' }, jobId: `full-${marketId}` }
  );

  // Trigger an immediate full sync to populate the new market
  await triggerFullSync(marketId);

  console.log(`[scheduler] Market ${market.mls_name} activated. Full sync triggered.`);
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function emitSyncComplete(
  marketId: string,
  stats: object,
): Promise<void> {
  // Lazy import to avoid circular dependency with the Socket.io server
  try {
    const { getIO } = await import('../../server');
    const io = getIO();
    io.to('agent').emit('sync_complete', { market_id: marketId, ...stats });
  } catch {
    // Socket.io not available (e.g. during testing) — silently skip
  }
}

async function alertAgentSyncFailed(
  marketId: string,
  errorMessage: string,
): Promise<void> {
  const { data: market } = await db
    .from('markets')
    .select('mls_name')
    .eq('id', marketId)
    .single();

  const mlsName = market?.mls_name ?? 'Unknown MLS';

  // Queue a push notification to the agent
  const { data: agentUser } = await db
    .from('users')
    .select('id')
    .eq('role', 'agent')
    .single();

  if (!agentUser) return;

  await db.from('notifications').insert({
    user_id: agentUser.id,
    type:    'sync_failed',
    title:   `MLS Sync Failed — ${mlsName}`,
    body:    `The sync job for ${mlsName} failed after 3 attempts: ${errorMessage}`,
    data:    { market_id: marketId },
    channel: 'push',
    status:  'pending',
  });

  console.error(`[scheduler] Agent alerted about sync failure for ${mlsName}`);
}

// -------------------------------------------------------------------------
// Graceful shutdown
// -------------------------------------------------------------------------

export async function shutdownSyncWorkers(): Promise<void> {
  await Promise.all([
    fullSyncWorker.close(),
    incrementalSyncWorker.close(),
    staleCheckWorker.close(),
  ]);
  await connection.quit();
  console.log('[scheduler] All sync workers shut down.');
}
