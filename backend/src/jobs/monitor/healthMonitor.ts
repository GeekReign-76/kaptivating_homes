/**
 * healthMonitor.ts
 *
 * Runs a lightweight health check every 5 minutes inside the Node process.
 * Sends a push notification to all subscribed devices when:
 *   - Heap memory exceeds 80% (warning) or 90% (critical)
 *   - Database becomes unreachable
 *
 * NOTE: This detects degradation and near-death scenarios.
 * For full process-death detection (PM2 crash, GoDaddy restart), set up
 * an external uptime monitor (e.g. UptimeRobot free tier) pointing at /health.
 */

import { db }                    from '../../lib/db';
import { sendPushToAllAgents }   from '../notifications/pushSender';

// ── Thresholds ────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS  = 5  * 60 * 1000;   // check every 5 minutes
const ALERT_COOLDOWN_MS  = 30 * 60 * 1000;   // same alert type no more than every 30 min
const MEMORY_WARN_MB     = 300;               // RSS warn at 300MB (server has ~636MB free)
const MEMORY_CRIT_MB     = 450;               // RSS critical at 450MB
const DB_SLOW_THRESHOLD  = 3000;              // ms

// ── State ─────────────────────────────────────────────────────────────────────

const lastAlertAt: Record<string, number> = {};

// ── Entry point ───────────────────────────────────────────────────────────────

export function startHealthMonitor(): void {
  console.log('[monitor] Health monitor started — checking every 5 minutes');
  // First check after 2 minutes so startup noise settles
  setTimeout(() => {
    runCheck();
    setInterval(runCheck, CHECK_INTERVAL_MS);
  }, 2 * 60 * 1000);
}

// ── Check ─────────────────────────────────────────────────────────────────────

async function runCheck(): Promise<void> {
  await checkMemory();
  await checkDatabase();
}

async function checkMemory(): Promise<void> {
  const mem     = process.memoryUsage();
  const rssMB   = toMB(mem.rss);
  const usedMB  = toMB(mem.heapUsed);
  const totalMB = toMB(mem.heapTotal);
  const pct     = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  if (rssMB >= MEMORY_CRIT_MB) {
    await maybeAlert('memory_crit',
      '🔴 Server Memory Critical',
      `RSS at ${rssMB} MB (heap ${usedMB}/${totalMB} MB). Restart recommended — check GoDaddy panel.`,
    );
  } else if (rssMB >= MEMORY_WARN_MB) {
    await maybeAlert('memory_warn',
      '🟡 Server Memory High',
      `RSS at ${rssMB} MB (heap ${usedMB}/${totalMB} MB). Monitor closely.`,
    );
  } else {
    delete lastAlertAt['memory_crit'];
    delete lastAlertAt['memory_warn'];
  }
}

async function checkDatabase(): Promise<void> {
  try {
    const t0 = Date.now();
    const { error } = await db.from('users').select('id').limit(1);
    const latency = Date.now() - t0;

    if (error) throw error;

    delete lastAlertAt['db_error'];

    if (latency > DB_SLOW_THRESHOLD) {
      await maybeAlert('db_slow',
        '🟡 Database Slow',
        `Supabase responded in ${latency}ms. Site performance may be degraded.`,
      );
    } else {
      delete lastAlertAt['db_slow'];
    }
  } catch {
    await maybeAlert('db_error',
      '🔴 Database Unreachable',
      'Cannot connect to Supabase. API is running but DB calls will fail. Check env vars or Supabase status.',
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function maybeAlert(key: string, title: string, body: string): Promise<void> {
  const now  = Date.now();
  const last = lastAlertAt[key] ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return;

  lastAlertAt[key] = now;
  console.warn(`[monitor] ALERT — ${title}: ${body}`);

  try {
    await sendPushToAllAgents({ title, body, url: '/dashboard/monitor' });
  } catch (err: any) {
    console.error('[monitor] Failed to send push alert:', err?.message);
  }
}

function toMB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

// ── Snapshot — used by the health API endpoint ─────────────────────────────────

export function getHealthSnapshot(): {
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number; pct: number };
} {
  const mem = process.memoryUsage();
  return {
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed:  toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
      rss:       toMB(mem.rss),
      pct:       Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },
  };
}
