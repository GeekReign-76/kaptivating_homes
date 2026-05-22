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
// POST /api/v1/appointments/public-book
// PUBLIC — no auth required.
// Accepts name + email + context, creates/finds the user, creates a pending
// appointment request, and notifies Karsten. Designed for first-time visitors
// who discovered a property and want to book a showing or consultation.
// -------------------------------------------------------------------------

appointmentsRouter.post('/public-book', async (req: Request, res: Response) => {
  const {
    name,
    email,
    phone,
    appointment_type,   // 'buyer_consultation' | 'property_showing' | 'relocation_consultation'
    preferred_date,     // ISO date string e.g. "2026-06-15"
    preferred_time,     // 'morning' | 'afternoon' | 'evening' | 'flexible'
    property_url,
    search_context,
    note,
  } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid email required' } });
  }
  if (!appointment_type) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'appointment_type required' } });
  }

  try {
    // 1. Upsert user by email
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    let userId = existing?.id;

    if (!userId) {
      const { data: newUser, error: userErr } = await db
        .from('users')
        .insert({ email: email.toLowerCase(), full_name: name ?? null, phone: phone ?? null, role: 'client' })
        .select('id')
        .single();
      if (userErr || !newUser) throw new Error(userErr?.message ?? 'Failed to create user');
      userId = newUser.id;
    } else {
      // Fill in any missing profile fields
      const updates: Record<string, any> = {};
      if (name)  updates.full_name = name;
      if (phone) updates.phone     = phone;
      if (Object.keys(updates).length) {
        await db.from('users').update(updates).eq('id', userId);
      }
    }

    // 2. Upsert lead record
    const { data: existingLead } = await db
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingLead) {
      await db.from('leads').insert({
        user_id: userId,
        status:  'warm',
        source:  'appointment_request',
        notes:   [
          search_context ? `Context: ${search_context}` : null,
          property_url   ? `Property: ${property_url}`  : null,
          note           ? `Note: ${note}`               : null,
        ].filter(Boolean).join(' | ') || null,
      });
    }

    // 3. Build the appointment notes string
    const appointmentNotes = [
      search_context ? `Browsing context: ${search_context}` : null,
      property_url   ? `Property of interest: ${property_url}` : null,
      preferred_date ? `Preferred date: ${preferred_date} (${preferred_time ?? 'flexible'})` : null,
      note           ? `Client note: ${note}` : null,
    ].filter(Boolean).join('\n');

    // 4. Look up the appointment type id by slug/name
    const { data: apptType } = await db
      .from('appointment_types')
      .select('id, duration_minutes')
      .ilike('name', `%${appointment_type.replace(/_/g, ' ')}%`)
      .eq('is_active', true)
      .maybeSingle();

    // 5. Create a pending appointment (no confirmed time yet — agent will confirm)
    const requestedStart = preferred_date
      ? new Date(`${preferred_date}T12:00:00`)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d; })();
    const durationMs = (apptType?.duration_minutes ?? 60) * 60 * 1000;
    const requestedEnd = new Date(requestedStart.getTime() + durationMs);

    const { data: appointment, error: apptErr } = await db
      .from('appointments')
      .insert({
        client_id:        userId,
        appointment_type: appointment_type,
        status:           'pending',
        requested_start:  requestedStart.toISOString(),
        requested_end:    requestedEnd.toISOString(),
        notes:            appointmentNotes || null,
      })
      .select()
      .single();

    if (apptErr || !appointment) throw new Error(apptErr?.message ?? 'Failed to create appointment');

    // 6. Notify agent
    const agentUserId = process.env.AGENT_USER_ID;
    if (agentUserId) {
      const displayName  = name ? `${name} (${email})` : email;
      const typeLabel    = appointment_type.replace(/_/g, ' ');
      const dateLabel    = preferred_date ? ` for ${preferred_date}` : '';
      try {
        await db.from('notifications').insert({
          user_id:  agentUserId,
          type:     'new_appointment',
          title:    'New Appointment Request',
          body:     `${displayName} requested a ${typeLabel}${dateLabel}.${property_url ? ' Has a property in mind.' : ''}`,
          metadata: { appointment_id: appointment.id, user_id: userId, source: 'public_booking' },
          channel:  'push',
        });
      } catch { /* non-critical — appointment already saved */ }
    }

    return res.status(201).json({ data: { booked: true, appointment_id: appointment.id }, error: null });
  } catch (err: any) {
    return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: err.message } });
  }
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

appointmentsRouter.get('/availability/blocks', requireAgent, async (_req, res) => {
  const { data, error } = await db
    .from('availability_blocks')
    .select('*')
    .order('blocked_date');
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

appointmentsRouter.delete('/availability/blocks/:idOrDate', requireAgent, async (req, res) => {
  const param = req.params.idOrDate;
  // If it looks like a date (YYYY-MM-DD), delete by blocked_date; otherwise by id
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(param);
  const query = isDate
    ? db.from('availability_blocks').delete().eq('blocked_date', param)
    : db.from('availability_blocks').delete().eq('id', param);
  const { error } = await query;
  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data: { message: 'Block removed.' }, error: null });
});

appointmentsRouter.patch('/appointment-types/:id', requireAgent, async (req, res) => {
  const allowed = ['name', 'description', 'duration_minutes', 'buffer_minutes', 'is_active', 'display_order'];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  // Map frontend 'enabled' to DB 'is_active'
  if ('enabled' in req.body) updates.is_active = req.body.enabled;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } });
  }

  const { data, error } = await db
    .from('appointment_types')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message: error.message } });
  return res.json({ data, error: null });
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

