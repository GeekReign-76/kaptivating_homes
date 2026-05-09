/**
 * listings.ts
 *
 * Property search and listing detail endpoints.
 * All read endpoints are public (no auth).
 * Write endpoints (manual listings) require agent auth.
 *
 * Endpoints:
 *   GET  /api/v1/listings            — search / filter (public)
 *   GET  /api/v1/listings/:id        — listing detail (public)
 *   POST /api/v1/listings/manual     — create manual listing (agent)
 *   PATCH /api/v1/listings/manual/:id — update manual listing (agent)
 *   DELETE /api/v1/listings/manual/:id — delete manual listing (agent)
 *   PATCH /api/v1/listings/manual/:id/star — toggle starred (agent)
 *   GET  /api/v1/listings/saved      — get client's saved listings (auth)
 *   POST /api/v1/listings/:id/save   — save a listing (auth)
 *   DELETE /api/v1/listings/:id/save — unsave a listing (auth)
 */

import { Router, Request, Response } from 'express';
import { db }                        from '../lib/db';
import { authMiddleware, requireAgent } from '../middleware/auth';

export const listingsRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/listings — public property search
// Uses the v_listings unified view (MLS + manual listings)
// -------------------------------------------------------------------------

listingsRouter.get('/', async (req: Request, res: Response) => {
  const {
    states,
    property_type,
    status      = 'Active',
    min_price,
    max_price,
    min_beds,
    max_beds,
    min_baths,
    city,
    zip,
    keyword,
    page        = '1',
    limit       = '24',
    sort        = 'listed_at:desc',
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page  as string, 10));
  const limitNum = Math.min(50, parseInt(limit as string, 10));
  const offset   = (pageNum - 1) * limitNum;

  let query = db
    .from('v_listings')
    .select('*', { count: 'exact' })
    .range(offset, offset + limitNum - 1);

  // Filters
  if (states) {
    const stateList = (states as string).split(',');
    query = query.in('state', stateList);
  }

  if (property_type) {
    const types = (property_type as string).split(',');
    query = query.in('property_type', types);
  }

  if (status) {
    const statuses = (status as string).split(',');
    query = query.in('status', statuses);
  }

  if (min_price) query = query.gte('price', parseInt(min_price as string, 10));
  if (max_price) query = query.lte('price', parseInt(max_price as string, 10));
  if (min_beds)  query = query.gte('beds',  parseFloat(min_beds as string));
  if (max_beds)  query = query.lte('beds',  parseFloat(max_beds as string));
  if (min_baths) query = query.gte('baths', parseFloat(min_baths as string));

  if (city)    query = query.ilike('city', `%${city}%`);
  if (zip)     query = query.eq('zip', zip as string);
  if (keyword) query = query.ilike('address', `%${keyword}%`);

  // Sort
  const [sortCol, sortDir] = (sort as string).split(':');
  const ascending = sortDir !== 'desc';
  const allowedSortCols = ['price', 'listed_at', 'beds', 'sqft', 'baths'];
  if (allowedSortCols.includes(sortCol)) {
    query = query.order(sortCol, { ascending });
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({
      data:  null,
      error: { code: 'SERVER_ERROR', message: error.message },
    });
  }

  return res.json({
    data,
    error: null,
    meta: { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// GET /api/v1/listings/saved — authenticated client's saved listings
// -------------------------------------------------------------------------

listingsRouter.get('/saved', authMiddleware, async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('saved_listings')
    .select(`
      saved_at,
      listing:v_listings ( * )
    `)
    .eq('user_id', req.user!.id)
    .order('saved_at', { ascending: false });

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: data?.map(r => ({ ...r.listing, saved_at: r.saved_at })) ?? [], error: null });
});

// -------------------------------------------------------------------------
// GET /api/v1/listings/:id — public listing detail
// -------------------------------------------------------------------------

listingsRouter.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await db
    .from('v_listings')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({
      data:  null,
      error: { code: 'NOT_FOUND', message: 'Listing not found' },
    });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/listings/manual — agent creates a manual listing
// -------------------------------------------------------------------------

listingsRouter.post('/manual', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const {
    address, city, state, zip, price, beds, baths, sqft,
    property_type, status = 'Active', description, photos,
    is_starred = false,
  } = req.body;

  if (!address || !city || !state || !price) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'address, city, state, and price are required' },
    });
  }

  const { data, error } = await db
    .from('manual_listings')
    .insert({
      address, city, state, zip: zip ?? null, price,
      beds: beds ?? null, baths: baths ?? null, sqft: sqft ?? null,
      property_type: property_type ?? 'Residential',
      status,
      description: description ?? null,
      photos:    photos    ?? [],
      is_starred,
    })
    .select()
    .single();

  if (error || !data) {
    return res.status(500).json({
      data:  null,
      error: { code: 'SERVER_ERROR', message: error?.message ?? 'Failed to create listing' },
    });
  }

  return res.status(201).json({ data, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/listings/manual/:id — agent updates a manual listing
// -------------------------------------------------------------------------

listingsRouter.patch('/manual/:id', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const allowed = [
    'address', 'city', 'state', 'zip', 'price', 'beds', 'baths', 'sqft',
    'property_type', 'status', 'description', 'photos', 'is_starred',
  ];
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
    .from('manual_listings')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({
      data:  null,
      error: { code: 'NOT_FOUND', message: 'Listing not found or update failed' },
    });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/listings/manual/:id — agent soft-deletes a manual listing
// -------------------------------------------------------------------------

listingsRouter.delete('/manual/:id', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { error } = await db
    .from('manual_listings')
    .update({ status: 'Deleted' })
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: { deleted: true }, error: null });
});

// -------------------------------------------------------------------------
// PATCH /api/v1/listings/manual/:id/star — agent toggles star flag
// -------------------------------------------------------------------------

listingsRouter.patch('/manual/:id/star', authMiddleware, requireAgent, async (req: Request, res: Response) => {
  const { is_starred } = req.body;

  if (typeof is_starred !== 'boolean') {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'is_starred must be a boolean' },
    });
  }

  const { data, error } = await db
    .from('manual_listings')
    .update({ is_starred })
    .eq('id', req.params.id)
    .select('id, is_starred')
    .single();

  if (error || !data) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Listing not found' } });
  }

  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/listings/:id/save — client saves a listing
// -------------------------------------------------------------------------

listingsRouter.post('/:id/save', authMiddleware, async (req: Request, res: Response) => {
  const { listing_type = 'mls' } = req.body;

  const { error } = await db
    .from('saved_listings')
    .upsert(
      {
        user_id:      req.user!.id,
        listing_id:   req.params.id,
        listing_type,
      },
      { onConflict: 'user_id,listing_id' },
    );

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.status(201).json({ data: { saved: true }, error: null });
});

// -------------------------------------------------------------------------
// DELETE /api/v1/listings/:id/save — client unsaves a listing
// -------------------------------------------------------------------------

listingsRouter.delete('/:id/save', authMiddleware, async (req: Request, res: Response) => {
  const { error } = await db
    .from('saved_listings')
    .delete()
    .eq('user_id', req.user!.id)
    .eq('listing_id', req.params.id);

  if (error) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  }

  return res.json({ data: { saved: false }, error: null });
});
