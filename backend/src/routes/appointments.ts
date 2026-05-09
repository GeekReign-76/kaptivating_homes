/**
 * appointments.ts — Express route handlers
 *
 * All business logic is in appointmentService.ts.
 * Route handlers are responsible for:
 *   - Parsing + validating request inputs
 *   - Calling the service
 *   - Mapping service errors to HTTP responses
 *   - Formatting the response envelope
 */

import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import {
  getAvailableSlots,
  bookAppointment,
  confirmAppointment,
  counterProposeAppointment,
  acceptCounter,
  cancelAppointment,
  completeAppointment,
  markNoShow,
  getAppointmentById,
} from '../services/appointmentService';

export const appointmentsRouter = Router();

// -------------------------------------------------------------------------
// GET /api/v1/availability
// Public — returns available slots for a given appointment type + date range
// -------------------------------------------------------------------------

appointmentsRouter.get('/availability', async (req: Request, res: Response) => {
  const { appointment_type_id, start_date, end_date } = req.query;

  if (!appointment_type_id || !start_date || !end_date) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'appointment_type_id, start_date, and end_date are required' },
    });
  }

  const startDate = new Date(start_date as string);
  const endDate   = new Date(end_date as string);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid date format. Use YYYY-MM-DD.' },
    });
  }

  if (startDate > endDate) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'start_date must be before end_date' },
    });
  }

  try {
    const result = await getAvailableSlots({
      appointmentTypeId: appointment_type_id as string,
      startDate,
      endDate,
    });
    return res.json({ data: result, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// GET /api/v1/appointment-types
// Public — list all active appointment types
// -------------------------------------------------------------------------

appointmentsRouter.get('/appointment-types', async (_req: Request, res: Response) => {
  const { data, error } = await db
    .from('appointment_types')
    .select('id, name, description, duration_minutes, color')
    .eq('is_active', true)
    .order('display_order');

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data, error: null });
});

// -------------------------------------------------------------------------
// POST /api/v1/appointments
// Requires auth (client) — book a slot or suggest a time
// -------------------------------------------------------------------------

appointmentsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const {
    appointment_type_id,
    requested_start,
    requested_end,
    booking_type,
    related_listing_id,
    related_listing_type,
    client_note,
  } = req.body;

  // Validation
  const errors: Record<string, string> = {};
  if (!appointment_type_id)    errors.appointment_type_id = 'Required';
  if (!requested_start)        errors.requested_start     = 'Required';
  if (!requested_end)          errors.requested_end       = 'Required';
  if (!['slot', 'suggestion'].includes(booking_type)) {
    errors.booking_type = 'Must be "slot" or "suggestion"';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      data:  { fields: errors },
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.' },
    });
  }

  try {
    const appointment = await bookAppointment({
      clientId:            req.user!.id,
      appointmentTypeId:   appointment_type_id,
      requestedStart:      new Date(requested_start),
      requestedEnd:        new Date(requested_end),
      bookingType:         booking_type,
      relatedListingId:    related_listing_id,
      relatedListingType:  related_listing_type,
      clientNote:          client_note,
    });

    return res.status(201).json({ data: appointment, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// GET /api/v1/appointments
// Agent: all appointments | Client: own appointments
// -------------------------------------------------------------------------

appointmentsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const { status, from, to, client_id, page = '1', limit = '20' } = req.query;

  const pageNum  = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset   = (pageNum - 1) * limitNum;

  let query = db
    .from('appointments')
    .select(`
      *,
      appointment_types ( id, name, duration_minutes, color ),
      client:users!appointments_client_id_fkey ( id, full_name, email, phone )
    `, { count: 'exact' })
    .order('confirmed_start', { ascending: true })
    .range(offset, offset + limitNum - 1);

  // Role-based filtering
  if (req.user!.role !== 'agent') {
    query = query.eq('client_id', req.user!.id);
  } else if (client_id) {
    query = query.eq('client_id', client_id as string);
  }

  // Status filter
  if (status) {
    const statuses = (status as string).split(',');
    query = query.in('status', statuses);
  }

  // Date range filter
  if (from) query = query.gte('confirmed_start', new Date(from as string).toISOString());
  if (to)   query = query.lte('confirmed_start', new Date(to as string).toISOString());

  const { data, error, count } = await query;

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });

  return res.json({
    data,
    error: null,
    meta: { page: pageNum, limit: limitNum, total: count ?? 0 },
  });
});

// -------------------------------------------------------------------------
// GET /api/v1/appointments/:id
// -------------------------------------------------------------------------

appointmentsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const appt = await getAppointmentById(req.params.id);

    // Clients can only view their own appointments
    if (req.user!.role !== 'agent' && appt.client_id !== req.user!.id) {
      return res.status(403).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not your appointment' } });
    }

    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/confirm  — agent confirms pending/suggested
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/confirm', requireAgent, async (req: Request, res: Response) => {
  try {
    const appt = await confirmAppointment(req.params.id, req.body.agent_note);
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/counter  — agent proposes different time
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/counter', requireAgent, async (req: Request, res: Response) => {
  const { counter_start, counter_end, agent_note } = req.body;

  if (!counter_start || !counter_end) {
    return res.status(400).json({
      data:  null,
      error: { code: 'VALIDATION_ERROR', message: 'counter_start and counter_end are required' },
    });
  }

  try {
    const appt = await counterProposeAppointment(
      req.params.id,
      new Date(counter_start),
      new Date(counter_end),
      agent_note,
    );
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/accept-counter  — client accepts counter
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/accept-counter', requireAuth, async (req: Request, res: Response) => {
  try {
    const appt = await acceptCounter(req.params.id, req.user!.id);
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/cancel  — agent or client cancels
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { reason } = req.body;
  const cancelledBy = req.user!.role === 'agent' ? 'agent' : 'client';

  // Clients can only cancel their own
  if (cancelledBy === 'client') {
    const appt = await getAppointmentById(req.params.id).catch(() => null);
    if (appt && appt.client_id !== req.user!.id) {
      return res.status(403).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not your appointment' } });
    }
  }

  try {
    const appt = await cancelAppointment(req.params.id, cancelledBy, reason);
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/complete  — agent marks done
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/complete', requireAgent, async (req: Request, res: Response) => {
  try {
    const appt = await completeAppointment(req.params.id);
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// PATCH /api/v1/appointments/:id/no-show  — agent marks no-show
// -------------------------------------------------------------------------

appointmentsRouter.patch('/:id/no-show', requireAgent, async (req: Request, res: Response) => {
  try {
    const appt = await markNoShow(req.params.id);
    return res.json({ data: appt, error: null });
  } catch (err: any) {
    return handleError(res, err);
  }
});

// -------------------------------------------------------------------------
// Availability Windows (agent only)
// -------------------------------------------------------------------------

appointmentsRouter.get('/availability/windows', requireAgent, async (_req, res) => {
  const { data, error } = await db
    .from('availability_windows')
    .select('*')
    .order('day_of_week');
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data, error: null });
});

appointmentsRouter.put('/availability/windows', requireAgent, async (req, res) => {
  const { windows } = req.body;

  if (!Array.isArray(windows) || windows.length === 0) {
    return res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'windows must be a non-empty array' },
    });
  }

  // Delete all existing windows and replace (simpler than partial update for a weekly schedule)
  await db.from('availability_windows').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const rows = windows.map((w: any) => ({
    day_of_week: w.day_of_week,
    start_time:  w.start_time,
    end_time:    w.end_time,
    is_active:   true,
  }));

  const { data, error } = await db.from('availability_windows').insert(rows).select();
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data, error: null });
});

appointmentsRouter.post('/availability/blocks', requireAgent, async (req, res) => {
  const { blocked_date, start_time, end_time, reason } = req.body;

  if (!blocked_date) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'blocked_date is required' } });
  }

  const { data, error } = await db
    .from('availability_blocks')
    .insert({ blocked_date, start_time: start_time ?? null, end_time: end_time ?? null, reason: reason ?? null })
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.status(201).json({ data, error: null });
});

appointmentsRouter.delete('/availability/blocks/:id', requireAgent, async (req, res) => {
  const { error } = await db.from('availability_blocks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data: { message: 'Block removed.' }, error: null });
});

// -------------------------------------------------------------------------
// Auth middleware (attached to req.user by the main auth middleware)
// -------------------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: Function): void {
  if (!req.user) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  next();
}

function requireAgent(req: Request, res: Response, next: Function): void {
  if (!req.user || req.user.role !== 'agent') {
    res.status(403).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Agent access required' } });
    return;
  }
  next();
}

// -------------------------------------------------------------------------
// Error handler — maps service error codes to HTTP status codes
// -------------------------------------------------------------------------

function handleError(res: Response, err: any): Response {
  const code = err.code ?? 'SERVER_ERROR';
  const statusMap: Record<string, number> = {
    NOT_FOUND:          404,
    UNAUTHORIZED:       403,
    VALIDATION_ERROR:   400,
    SLOT_UNAVAILABLE:   422,
    INVALID_TRANSITION: 422,
    SERVER_ERROR:       500,
  };
  const status = statusMap[code] ?? 500;
  console.error(`[appointments] ${code}:`, err.message);
  return res.status(status).json({ data: null, error: { code, message: err.message } });
}

// TypeScript augmentation for req.user (set by auth middleware)
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
