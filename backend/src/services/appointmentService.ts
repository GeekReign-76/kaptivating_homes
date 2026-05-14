/**
 * appointmentService.ts
 *
 * Business logic layer for all appointment operations.
 * Routes call these functions — no raw DB queries in route handlers.
 *
 * State transition validation lives here.
 * All notifications are triggered from here via createNotification().
 */

import { db } from '../lib/db';
import { createNotification } from '../jobs/notifications/notificationWorker';
import { generateCalendarInvite } from './calendarInvite';
import { calculateSlotsForDateRange } from './slotCalculator';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface BookSlotParams {
  clientId:            string;
  appointmentTypeId:   string;
  requestedStart:      Date;
  requestedEnd:        Date;
  bookingType:         'slot' | 'suggestion';
  relatedListingId?:   string;
  relatedListingType?: 'mls' | 'manual';
  clientNote?:         string;
}

export interface AvailabilityQueryParams {
  appointmentTypeId: string;
  startDate:         Date;
  endDate:           Date;
}

// -------------------------------------------------------------------------
// getAvailableSlots
// Called by GET /api/v1/availability
// -------------------------------------------------------------------------

export async function getAvailableSlots(params: AvailabilityQueryParams) {
  const { appointmentTypeId, startDate, endDate } = params;

  // Enforce max range (60 days)
  const maxEnd = new Date(startDate);
  maxEnd.setDate(maxEnd.getDate() + 60);
  const effectiveEnd = endDate > maxEnd ? maxEnd : endDate;

  // Fetch appointment type (for duration and buffer)
  const { data: apptType, error: typeError } = await db
    .from('appointment_types')
    .select('id, name, duration_minutes, buffer_minutes')
    .eq('id', appointmentTypeId)
    .eq('is_active', true)
    .single();

  if (typeError || !apptType) {
    throw Object.assign(new Error('Appointment type not found'), { code: 'NOT_FOUND' });
  }

  // Fetch agent settings
  const { data: settings } = await db
    .from('agent_settings')
    .select('key, value')
    .in('key', ['agent_timezone', 'booking_notice_hours', 'max_advance_days']);

  const settingsMap = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]));
  const agentTimezone      = settingsMap['agent_timezone']      ?? 'America/New_York';
  const bookingNoticeHours = parseInt(settingsMap['booking_notice_hours'] ?? '2', 10);

  // Fetch all availability windows
  const { data: windows } = await db
    .from('availability_windows')
    .select('day_of_week, start_time, end_time, is_active')
    .eq('is_active', true);

  // Fetch blocks in date range
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr   = effectiveEnd.toISOString().slice(0, 10);

  const { data: blocks } = await db
    .from('availability_blocks')
    .select('blocked_date, start_time, end_time')
    .gte('blocked_date', startStr)
    .lte('blocked_date', endStr);

  // Fetch existing confirmed/pending appointments in range
  const { data: existingAppts } = await db
    .from('appointments')
    .select(`
      confirmed_start,
      confirmed_end,
      appointment_types ( buffer_minutes )
    `)
    .in('status', ['pending', 'confirmed', 'counter_proposed'])
    .not('confirmed_start', 'is', null)
    .gte('confirmed_start', startDate.toISOString())
    .lte('confirmed_start', effectiveEnd.toISOString());

  const appointments = (existingAppts ?? []).map((a: any) => ({
    confirmed_start: a.confirmed_start,
    confirmed_end:   a.confirmed_end,
    buffer_minutes:  a.appointment_types?.buffer_minutes ?? apptType.buffer_minutes,
  }));

  const daySlots = calculateSlotsForDateRange(
    startDate,
    effectiveEnd,
    agentTimezone,
    apptType.duration_minutes,
    apptType.buffer_minutes,
    windows ?? [],
    blocks ?? [],
    appointments,
    bookingNoticeHours * 60,
  );

  return {
    appointment_type: apptType,
    slots: daySlots,
    timezone: agentTimezone,
  };
}

// -------------------------------------------------------------------------
// bookAppointment
// Called by POST /api/v1/appointments
// Uses the atomic Postgres RPC function to prevent double-booking
// -------------------------------------------------------------------------

export async function bookAppointment(params: BookSlotParams) {
  const {
    clientId,
    appointmentTypeId,
    requestedStart,
    requestedEnd,
    bookingType,
    relatedListingId,
    relatedListingType,
    clientNote,
  } = params;

  // Call the atomic Postgres function
  const { data: result, error } = await db.rpc('book_appointment', {
    p_client_id:            clientId,
    p_appointment_type_id:  appointmentTypeId,
    p_requested_start:      requestedStart.toISOString(),
    p_requested_end:        requestedEnd.toISOString(),
    p_booking_type:         bookingType,
    p_related_listing_id:   relatedListingId   ?? null,
    p_related_listing_type: relatedListingType ?? null,
    p_client_note:          clientNote         ?? null,
  });

  if (error) throw new Error(`Booking failed: ${error.message}`);

  if (result.error) {
    throw Object.assign(new Error(result.message), { code: result.error });
  }

  const appointmentId = result.appointment_id;
  const status        = result.status;

  // Fetch full appointment + type for notification
  const appointment = await getAppointmentById(appointmentId);

  // Trigger notifications based on outcome
  if (status === 'confirmed') {
    await notifyAppointmentConfirmed(appointment);
    await sendCalendarInvites(appointment);
  } else if (status === 'pending') {
    await notifyPendingBooking(appointment);
  } else if (status === 'suggested') {
    await notifySuggestionReceived(appointment);
  }

  return appointment;
}

// -------------------------------------------------------------------------
// confirmAppointment — agent confirms a pending booking
// -------------------------------------------------------------------------

export async function confirmAppointment(appointmentId: string, agentNote?: string) {
  const appt = await getAppointmentById(appointmentId);
  assertTransition(appt.status, 'confirmed', ['pending', 'suggested']);

  const { error } = await db
    .from('appointments')
    .update({
      status:          'confirmed',
      confirmed_start: appt.requested_start,  // confirm the requested time
      confirmed_end:   appt.requested_end,
      agent_note:      agentNote ?? appt.agent_note,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);

  const updated = await getAppointmentById(appointmentId);
  await notifyAppointmentConfirmed(updated);
  await sendCalendarInvites(updated);
  return updated;
}

// -------------------------------------------------------------------------
// counterProposeAppointment — agent proposes a different time
// -------------------------------------------------------------------------

export async function counterProposeAppointment(
  appointmentId: string,
  counterStart:  Date,
  counterEnd:    Date,
  agentNote?:    string,
) {
  const appt = await getAppointmentById(appointmentId);
  assertTransition(appt.status, 'counter_proposed', ['suggested']);

  const { error } = await db
    .from('appointments')
    .update({
      status:       'counter_proposed',
      counter_start: counterStart.toISOString(),
      counter_end:   counterEnd.toISOString(),
      agent_note:    agentNote ?? appt.agent_note,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);

  const updated = await getAppointmentById(appointmentId);
  await notifyCounterProposal(updated);
  return updated;
}

// -------------------------------------------------------------------------
// acceptCounter — client accepts the agent's counter-proposal
// -------------------------------------------------------------------------

export async function acceptCounter(appointmentId: string, clientId: string) {
  const appt = await getAppointmentById(appointmentId);

  if (appt.client_id !== clientId) {
    throw Object.assign(new Error('Not your appointment'), { code: 'UNAUTHORIZED' });
  }
  assertTransition(appt.status, 'confirmed', ['counter_proposed']);

  const { error } = await db
    .from('appointments')
    .update({
      status:          'confirmed',
      confirmed_start: appt.counter_start,
      confirmed_end:   appt.counter_end,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);

  const updated = await getAppointmentById(appointmentId);
  await notifyAppointmentConfirmed(updated);
  await sendCalendarInvites(updated);
  return updated;
}

// -------------------------------------------------------------------------
// cancelAppointment — called by either agent or client
// -------------------------------------------------------------------------

export async function cancelAppointment(
  appointmentId: string,
  cancelledBy:   'agent' | 'client',
  reason?:       string,
) {
  const appt = await getAppointmentById(appointmentId);

  const cancelStatus = cancelledBy === 'agent' ? 'cancelled_agent' : 'cancelled_client';
  const validFromStatuses = ['pending', 'suggested', 'confirmed', 'counter_proposed'];
  assertTransition(appt.status, cancelStatus, validFromStatuses);

  const { error } = await db
    .from('appointments')
    .update({
      status:               cancelStatus,
      cancellation_reason:  reason ?? null,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);

  const updated = await getAppointmentById(appointmentId);
  await notifyCancellation(updated, cancelledBy);
  return updated;
}

// -------------------------------------------------------------------------
// completeAppointment — agent marks appointment as done
// -------------------------------------------------------------------------

export async function completeAppointment(appointmentId: string) {
  const appt = await getAppointmentById(appointmentId);
  assertTransition(appt.status, 'completed', ['confirmed']);

  const { error } = await db
    .from('appointments')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);
  return getAppointmentById(appointmentId);
}

// -------------------------------------------------------------------------
// markNoShow — agent marks client as a no-show
// -------------------------------------------------------------------------

export async function markNoShow(appointmentId: string) {
  const appt = await getAppointmentById(appointmentId);
  assertTransition(appt.status, 'no_show', ['confirmed']);

  const { error } = await db
    .from('appointments')
    .update({ status: 'no_show', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);

  if (error) throw new Error(error.message);
  return getAppointmentById(appointmentId);
}

// -------------------------------------------------------------------------
// getAppointmentById — shared fetch with full join
// -------------------------------------------------------------------------

export async function getAppointmentById(id: string) {
  const { data, error } = await db
    .from('appointments')
    .select(`
      *,
      appointment_types ( id, name, duration_minutes, buffer_minutes, color ),
      client:users!appointments_client_id_fkey ( id, full_name, email, phone )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Appointment not found'), { code: 'NOT_FOUND' });
  }
  return data;
}

// -------------------------------------------------------------------------
// State machine guard
// -------------------------------------------------------------------------

function assertTransition(
  currentStatus: string,
  targetStatus:  string,
  allowedFrom:   string[],
): void {
  if (!allowedFrom.includes(currentStatus)) {
    throw Object.assign(
      new Error(
        `Cannot transition from "${currentStatus}" to "${targetStatus}". ` +
        `Allowed from: ${allowedFrom.join(', ')}`
      ),
      { code: 'INVALID_TRANSITION' }
    );
  }
}

// -------------------------------------------------------------------------
// Notification helpers
// -------------------------------------------------------------------------

async function getAgentUser(): Promise<{ id: string; full_name: string; email: string } | null> {
  const { data } = await db
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'agent')
    .single();
  return data;
}

async function notifyAppointmentConfirmed(appt: any): Promise<void> {
  const typeName   = appt.appointment_types?.name ?? 'Appointment';
  const startTime  = formatDateTime(appt.confirmed_start);
  const clientName = appt.client?.full_name ?? 'Client';
  const agent      = await getAgentUser();

  // Notify client
  await createNotification(
    appt.client_id,
    'appointment_confirmed',
    'Appointment Confirmed',
    `Your ${typeName} is confirmed for ${startTime}`,
    { appointment_id: appt.id },
  );

  // Notify agent
  if (agent) {
    await createNotification(
      agent.id,
      'appointment_confirmed',
      'Appointment Confirmed',
      `${typeName} with ${clientName} confirmed for ${startTime}`,
      { appointment_id: appt.id },
    );
  }
}

async function notifyPendingBooking(appt: any): Promise<void> {
  const typeName   = appt.appointment_types?.name ?? 'Appointment';
  const startTime  = formatDateTime(appt.requested_start);
  const clientName = appt.client?.full_name ?? 'Client';
  const agent      = await getAgentUser();

  if (agent) {
    await createNotification(
      agent.id,
      'time_suggestion_received',
      'New Booking — Action Required',
      `${clientName} booked a ${typeName} for ${startTime}. Please confirm.`,
      { appointment_id: appt.id },
    );
  }
}

async function notifySuggestionReceived(appt: any): Promise<void> {
  const typeName   = appt.appointment_types?.name ?? 'Appointment';
  const startTime  = formatDateTime(appt.requested_start);
  const clientName = appt.client?.full_name ?? 'Client';
  const agent      = await getAgentUser();

  if (agent) {
    await createNotification(
      agent.id,
      'time_suggestion_received',
      `New Time Request from ${clientName}`,
      `${clientName} requested a ${typeName} at ${startTime}`,
      { appointment_id: appt.id },
    );
  }
}

async function notifyCounterProposal(appt: any): Promise<void> {
  const typeName  = appt.appointment_types?.name ?? 'Appointment';
  const startTime = formatDateTime(appt.counter_start);

  await createNotification(
    appt.client_id,
    'time_suggestion_response',
    'Counter-Proposal Received',
    `Agent suggested ${startTime} for your ${typeName} instead`,
    { appointment_id: appt.id },
  );
}

async function notifyCancellation(appt: any, cancelledBy: 'agent' | 'client'): Promise<void> {
  const typeName   = appt.appointment_types?.name ?? 'Appointment';
  const clientName = appt.client?.full_name ?? 'Client';
  const agent      = await getAgentUser();

  if (cancelledBy === 'agent') {
    await createNotification(
      appt.client_id,
      'appointment_cancelled_agent',
      'Appointment Cancelled',
      `Your ${typeName} has been cancelled.${appt.cancellation_reason ? ' Reason: ' + appt.cancellation_reason : ''}`,
      { appointment_id: appt.id },
    );
  } else {
    if (agent) {
      await createNotification(
        agent.id,
        'appointment_cancelled_client',
        'Appointment Cancelled',
        `${clientName} cancelled their ${typeName}.${appt.cancellation_reason ? ' Reason: ' + appt.cancellation_reason : ''}`,
        { appointment_id: appt.id },
      );
    }
  }
}

// -------------------------------------------------------------------------
// Calendar invite helper
// -------------------------------------------------------------------------

async function sendCalendarInvites(appt: any): Promise<void> {
  try {
    const icsContent = generateCalendarInvite(appt);
    const agent = await getAgentUser();

    // Queue email with .ics attachment to both parties
    // (handled by the email worker — not shown here)
    const { getEmailQueue } = await import('../jobs/notifications/notificationWorker');
    const emailQueue = getEmailQueue();
    const clientName = appt.client?.full_name ?? 'Client';
    const clientEmail = appt.client?.email;
    const typeName  = appt.appointment_types?.name ?? 'Appointment';

    if (clientEmail) {
      await emailQueue?.add('send-calendar-invite', {
        to:          clientEmail,
        to_name:     clientName,
        subject:     `Confirmed: ${typeName} — ${formatDateShort(appt.confirmed_start)}`,
        appointment: appt,
        ics_content: icsContent,
        type:        'appointment_confirmed',
      });
    }
  } catch (err) {
    // Non-blocking — log but don't fail the booking
    console.error('[appointmentService] Failed to send calendar invite:', err);
  }
}

// -------------------------------------------------------------------------
// Date formatting helpers
// -------------------------------------------------------------------------

function formatDateTime(isoString: string): string {
  if (!isoString) return 'TBD';
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function formatDateShort(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
