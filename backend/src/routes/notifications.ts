/**
 * notifications.ts
 *
 * Push subscription management and notification inbox.
 *
 * Endpoints:
 *   POST   /api/v1/push/subscribe     — save push subscription for user device
 *   DELETE /api/v1/push/subscribe     — remove subscription on logout/unsubscribe
 *   GET    /api/v1/notifications      — paginated in-app notification inbox
 *   PATCH  /api/v1/notifications/:id/read — mark single notification read
 *   POST   /api/v1/notifications/read-all — mark all as read
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware }            from '../middleware/auth';

export const notificationsRouter = Router();

// All endpoints require auth
notificationsRouter.use(authMiddleware);

// -------------------------------------------------------------------------
// POST /api/v1/push/subscribe
// -------------------------------------------------------------------------

notificationsRouter.post('/push/subscribe', async (req: Request, res: Response) => {
  const { endpoint, p256dh, auth, user_agent } = req.body;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'endpoint, p256dh, and auth are required' },
    });
  }

  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        user_id:    req.user!.id,
        endpoint,
        p256dh,
        auth,
        user_agent: user_agent ?? null,
      },
      { onConflict: 'endpoint' },
    );

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.status(201).json({ data: { subscribed: true }, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/push/subscribe
// -------------------------------------------------------------------------

notificationsRouter.delete('/push/subscribe', async (req: Request, res: Response) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'endpoint is required' } });
  }

  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('user_id', req.user!.id)
    .eq('endpoint', endpoint);

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({ data: { unsubscribed: true }, error: null });
});

// -------------------------------------------------------------------------
// GET /api/v1/notifications
// -------------------------------------------------------------------------

notificationsRouter.get('/', async (req: Request, res: Response) => {
  const { unread_only, page = '1', limit = '20' } = req.query;
  const pageNum  = Math.max(1, parseInt(page  as string, 10));
  const limitNum = Math.min(50, parseInt(limit as string, 10));
  const offset   = (pageNum - 1) * limitNum;

  let query = db
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (unread_only === 'true') {
    query = query.is('read_at', null);
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({
    data,
    error: null,
    meta: { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/notifications/:id/read
// -------------------------------------------------------------------------

notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .is('read_at', null)
    .select('id, read_at')
    .single();

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({ data: data ?? { already_read: true }, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/notifications/read-all
// -------------------------------------------------------------------------

notificationsRouter.post('/read-all', async (req: Request, res: Response) => {
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', req.user!.id)
    .is('read_at', null)
    .select('id');

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({ data: { marked_read: data?.length ?? 0 }, error: null });
});
