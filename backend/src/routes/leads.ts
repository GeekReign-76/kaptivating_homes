/**
 * leads.ts
 *
 * Agent-only lead management dashboard.
 * Leads are created automatically when clients register / start threads / chat.
 * Agent can update notes, status, and assign tags.
 *
 * Endpoints:
 *   GET   /api/v1/leads           — paginated leads list with filters
 *   GET   /api/v1/leads/:id       — lead detail (client profile + activity)
 *   PATCH /api/v1/leads/:id       — update status, notes, tags
 *   GET   /api/v1/leads/:id/activity — thread + appointment + chat timeline
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware, requireAgent } from '../middleware/auth';
import { createNotification }        from '../jobs/notifications/notificationWorker';

export const leadsRouter = Router();

// -------------------------------------------------------------------------
// POST /api/v1/leads/capture — PUBLIC, no auth required
// Zero-friction lead capture: email + optional name + source context
// -------------------------------------------------------------------------

leadsRouter.post('/capture', async (req: Request, res: Response) => {
  const { email, name, source, context } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid email required' } });
  }

  try {
    // Upsert a user record by email
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    let userId = existing?.id;

    if (!userId) {
      const { data: newUser, error: userErr } = await db
        .from('users')
        .insert({ email: email.toLowerCase(), full_name: name ?? null, role: 'client' })
        .select('id')
        .single();
      if (userErr || !newUser) throw new Error(userErr?.message ?? 'Failed to create user');
      userId = newUser.id;
    } else if (name) {
      // Fill in name if we have it and they didn't before
      await db.from('users').update({ full_name: name }).eq('id', userId).is('full_name', null);
    }

    // Upsert lead — one lead record per user
    const { data: existingLead } = await db
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingLead) {
      await db.from('leads').insert({
        user_id: userId,
        status:  'warm',
        source:  source ?? 'website',
        notes:   context ? `Captured via: ${context}` : null,
      });

      // Notify the agent
      const agentUserId = process.env.AGENT_USER_ID;
      if (agentUserId) {
        const displayName = name ? `${name} (${email})` : email;
        const sourceLabel = source === 'zip_notify'   ? 'area listing alert'
                          : source === 'save_listing' ? 'saved property'
                          : 'website';
        await createNotification(
          agentUserId,
          'new_lead',
          'New Lead Captured',
          `${displayName} signed up via ${sourceLabel}.${context ? ` Context: ${context}` : ''}`,
          { user_id: userId, source: source ?? 'website' },
          'push',
        ).catch(() => {}); // non-blocking — don't fail the capture if notification errors
      }
    }

    return res.status(201).json({ data: { captured: true }, error: null });
  } catch (err: any) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// All lead management endpoints are agent-only
leadsRouter.use(authMiddleware, requireAgent);

// -------------------------------------------------------------------------
// GET /api/v1/leads
// -------------------------------------------------------------------------

leadsRouter.get('/', async (req: Request, res: Response) => {
  const {
    status,
    source,
    search,
    page  = '1',
    limit = '25',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page  as string, 10));
  const limitNum = Math.min(100, parseInt(limit as string, 10));
  const offset   = (pageNum - 1) * limitNum;

  let query = db
    .from('leads')
    .select(`
      *,
      user:users ( id, full_name, email, phone, avatar_url, created_at )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  // Apply in-memory name/email search (simple approach; upgrade to DB FTS for scale)
  let results = data ?? [];
  if (search) {
    const term = (search as string).toLowerCase();
    results = results.filter((lead: any) =>
      lead.user?.full_name?.toLowerCase().includes(term) ||
      lead.user?.email?.toLowerCase().includes(term),
    );
  }

  return res.json({
    data:  results,
    error: null,
    meta:  { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// GET /api/v1/leads/:id
// -------------------------------------------------------------------------

leadsRouter.get('/:id', async (req: Request, res: Response) => {
  const { data: lead, error } = await db
    .from('leads')
    .select(`
      *,
      user:users ( id, full_name, email, phone, avatar_url, created_at )
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !lead) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
  }

  return res.json({ data: lead, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/leads/:id
// -------------------------------------------------------------------------

leadsRouter.patch('/:id', async (req: Request, res: Response) => {
  const allowed = ['status', 'notes', 'tags'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' },
    });
  }

  const { data, error } = await db
    .from('leads')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// GET /api/v1/leads/:id/activity
// Returns threads, appointments, and chat sessions for a lead's user
// -------------------------------------------------------------------------

leadsRouter.get('/:id/activity', async (req: Request, res: Response) => {
  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('user_id')
    .eq('id', req.params.id)
    .single();

  if (leadError || !lead) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
  }

  const userId = lead.user_id;

  const [threads, appointments, chatSessions] = await Promise.all([
    db.from('threads').select('id, subject, last_message_at, agent_unread_count')
      .eq('client_id', userId).order('last_message_at', { ascending: false }),
    db.from('appointments').select('id, appointment_type, status, requested_start, confirmed_start')
      .eq('client_id', userId).order('created_at', { ascending: false }),
    db.from('chat_sessions').select('id, status, started_at, ended_at, converted_thread_id')
      .eq('guest_email', userId).order('started_at', { ascending: false }).limit(10),
  ]);

  return res.json({
    data: {
      threads:       threads.data       ?? [],
      appointments:  appointments.data  ?? [],
      chat_sessions: chatSessions.data  ?? [],
    },
    error: null,
  });
});
