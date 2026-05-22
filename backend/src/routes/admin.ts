/**
 * admin.ts
 *
 * Agent-only admin endpoints.
 *
 * GET  /api/v1/admin/health       — detailed server health snapshot
 * POST /api/v1/admin/push/test    — send a test push notification to yourself
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAgent } from '../middleware/auth';
import { getHealthSnapshot }           from '../jobs/monitor/healthMonitor';
import { sendPushToUser }              from '../jobs/notifications/pushSender';
import { db }                          from '../lib/db';

export const adminRouter = Router();

adminRouter.use(authMiddleware, requireAgent);

// ── GET /api/v1/admin/health ──────────────────────────────────────────────────

adminRouter.get('/health', async (_req: Request, res: Response) => {
  const snap = getHealthSnapshot();

  // Live DB ping
  let dbOk      = false;
  let dbLatency = -1;
  try {
    const t0 = Date.now();
    const { error } = await db.from('users').select('id').limit(1);
    dbLatency = Date.now() - t0;
    dbOk = !error;
  } catch { /* db unreachable */ }

  // Derive status — use RSS (actual system memory) not heap percentage
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (!dbOk || snap.memory.rss >= 450) {
    status = 'critical';
  } else if (snap.memory.rss >= 300 || dbLatency > 3000) {
    status = 'degraded';
  }

  return res.json({
    data: {
      status,
      uptime:   snap.uptime,
      memory:   snap.memory,
      database: { ok: dbOk, latencyMs: dbLatency },
      redis:    { configured: !!process.env.REDIS_URL },
      process:  {
        pid:     process.pid,
        version: process.version,
        env:     process.env.NODE_ENV ?? 'development',
      },
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

// ── POST /api/v1/admin/push/test ──────────────────────────────────────────────

adminRouter.post('/push/test', async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const sent = await sendPushToUser(userId, {
    title: '✅ Push notifications working',
    body:  'Server monitoring is active. You\'ll be alerted if memory spikes or the database goes down.',
    tag:   'push-test',
    data: {
      url:             '/dashboard/monitor',
      notification_id: 'test',
      type:            'server_alert',
    },
  });

  if (!sent) {
    return res.status(400).json({
      data:  null,
      error: { code: 'NO_SUBSCRIPTION', message: 'No push subscription found for this device. Enable notifications first.' },
    });
  }

  return res.json({ data: { sent: true }, error: null });
});

// ── GET /api/v1/admin/push/subscriptions ─────────────────────────────────────

adminRouter.get('/push/subscriptions', async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, user_agent, created_at, last_used_at')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({ data, error: null });
});
