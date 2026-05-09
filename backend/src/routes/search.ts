/**
 * search.ts
 *
 * Saved search management for registered clients.
 * Guests see a teaser prompt — account required to save searches.
 *
 * Endpoints:
 *   GET    /api/v1/saved-searches       — list my saved searches
 *   POST   /api/v1/saved-searches       — create saved search
 *   PATCH  /api/v1/saved-searches/:id   — update saved search filters
 *   DELETE /api/v1/saved-searches/:id   — delete saved search
 *   PATCH  /api/v1/saved-searches/:id/notify — toggle email notification on/off
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware }            from '../middleware/auth';

export const searchRouter = Router();

// All saved search endpoints require authentication
searchRouter.use(authMiddleware);

// -------------------------------------------------------------------------
// GET /api/v1/saved-searches
// -------------------------------------------------------------------------

searchRouter.get('/', async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('saved_searches')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: data ?? [], error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/saved-searches
// -------------------------------------------------------------------------

searchRouter.post('/', async (req: Request, res: Response) => {
  const { name, filters, notify_on_new_listings = true } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'name is required' },
    });
  }

  if (!filters || typeof filters !== 'object') {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'filters object is required' },
    });
  }

  const { data, error } = await db
    .from('saved_searches')
    .insert({
      user_id:               req.user!.id,
      name:                  name.trim(),
      filters,
      notify_on_new_listings,
    })
    .select()
    .single();

  if (error || !data) {
    return res.status(500).json({
      data:  null,
      error: { code: 'SERVER_ERROR', message: error?.message ?? 'Failed to save search' },
    });
  }

  return res.status(201).json({ data, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/saved-searches/:id
// -------------------------------------------------------------------------

searchRouter.patch('/:id', async (req: Request, res: Response) => {
  const { name, filters } = req.body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined)    updates.name    = name;
  if (filters !== undefined) updates.filters = filters;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' },
    });
  }

  const { data, error } = await db
    .from('saved_searches')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)  // scoped to owner
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Saved search not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/saved-searches/:id
// -------------------------------------------------------------------------

searchRouter.delete('/:id', async (req: Request, res: Response) => {
  const { error } = await db
    .from('saved_searches')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: { deleted: true }, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/saved-searches/:id/notify
// -------------------------------------------------------------------------

searchRouter.patch('/:id/notify', async (req: Request, res: Response) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'enabled must be a boolean' },
    });
  }

  const { data, error } = await db
    .from('saved_searches')
    .update({ notify_on_new_listings: enabled })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('id, notify_on_new_listings')
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Saved search not found' } });
  }

  return res.json({ data, error: null });
});
