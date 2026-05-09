/**
 * workerRunner.ts
 *
 * Standalone BullMQ worker process — runs independently from the API server.
 *
 * On Railway/Render you run this as a separate service:
 *   start command: node dist/jobs/workerRunner.js
 *
 * It shares the same Redis instance as the API server.
 * Workers consume jobs from queues but do not serve HTTP traffic.
 *
 * Runs:
 *   - MLS sync workers (full, incremental, stale check, status changed)
 *   - Notification worker (in-app + push + email fallback)
 *   - Appointment reminder scheduler (30-min polling)
 *   - Saved search matcher (triggered per sync run)
 */

import 'dotenv/config';
import { setupSyncScheduler, shutdownSyncWorkers } from './sync/scheduler';
import { setupAppointmentReminderScheduler }        from './notifications/appointmentReminders';
import { initWebPush }                              from './notifications/pushSender';

async function main(): Promise<void> {
  console.log('[workerRunner] Starting background workers...');

  initWebPush();
  await setupSyncScheduler();
  await setupAppointmentReminderScheduler();

  console.log('[workerRunner] All workers running. Waiting for jobs...');
}

main().catch((err) => {
  console.error('[workerRunner] Fatal startup error:', err);
  process.exit(1);
});

// -------------------------------------------------------------------------
// Graceful shutdown
// -------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`[workerRunner] ${signal} received — draining workers`);
  await shutdownSyncWorkers();
  console.log('[workerRunner] Workers shut down cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Keep process alive (workers are event-driven)
process.stdin.resume();
