/**
 * calendarInvite.ts
 *
 * Generates iCalendar (.ics) files for appointment confirmations.
 * The .ics is attached to confirmation emails so clients and the agent
 * can add the appointment directly to Google Calendar, Apple Calendar,
 * or Outlook.
 *
 * When an appointment is rescheduled (counter-proposal accepted),
 * a new .ics is generated with SEQUENCE incremented so calendar apps
 * update the existing event instead of creating a duplicate.
 */

// -------------------------------------------------------------------------
// generateCalendarInvite
// -------------------------------------------------------------------------

export function generateCalendarInvite(appointment: any): string {
  const typeName    = appointment.appointment_types?.name ?? 'Appointment';
  const clientName  = appointment.client?.full_name        ?? 'Client';
  const clientEmail = appointment.client?.email            ?? '';
  const agentName   = process.env.AGENT_NAME               ?? 'Agent';
  const agentEmail  = process.env.AGENT_EMAIL               ?? '';
  const siteUrl     = process.env.SITE_URL                  ?? 'https://kaptivatinghomes.com';

  const startUtc = new Date(appointment.confirmed_start);
  const endUtc   = new Date(appointment.confirmed_end);
  const nowUtc   = new Date();

  // Determine location
  const location = buildLocation(appointment);

  // Description with appointment details + portal link
  const description = buildDescription(appointment, typeName, clientName, siteUrl);

  // SEQUENCE increments on reschedule — calendar apps use this to update vs duplicate
  const sequence = appointment.reschedule_count ?? 0;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Kaptivating Homes//Appointment System//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@kaptivatinghomes.com`,
    `DTSTAMP:${formatIcsDateTime(nowUtc)}`,
    `DTSTART:${formatIcsDateTime(startUtc)}`,
    `DTEND:${formatIcsDateTime(endUtc)}`,
    `SUMMARY:${escapeIcs(`${typeName} — Kaptivating Homes`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    `ORGANIZER;CN=${escapeIcs(agentName)}:mailto:${agentEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${escapeIcs(agentName)}:mailto:${agentEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeIcs(clientName)}:mailto:${clientEmail}`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:${sequence}`,
    `TRANSP:OPAQUE`,
    // 1-hour reminder (in addition to the app push notifications)
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${escapeIcs(typeName)} in 1 hour`,
    'END:VALARM',
    // 24-hour reminder
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Tomorrow: ${escapeIcs(typeName)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return foldIcsLines(lines);
}

// -------------------------------------------------------------------------
// generateCancellationInvite
//
// Sends a CANCEL method .ics when an appointment is cancelled.
// Calendar apps remove the event automatically.
// -------------------------------------------------------------------------

export function generateCancellationInvite(appointment: any): string {
  const typeName    = appointment.appointment_types?.name ?? 'Appointment';
  const agentName   = process.env.AGENT_NAME              ?? 'Agent';
  const agentEmail  = process.env.AGENT_EMAIL              ?? '';

  const startUtc = new Date(appointment.confirmed_start || appointment.requested_start);
  const endUtc   = new Date(appointment.confirmed_end   || appointment.requested_end);
  const nowUtc   = new Date();
  const sequence = (appointment.reschedule_count ?? 0) + 1;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Kaptivating Homes//Appointment System//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@kaptivatinghomes.com`,
    `DTSTAMP:${formatIcsDateTime(nowUtc)}`,
    `DTSTART:${formatIcsDateTime(startUtc)}`,
    `DTEND:${formatIcsDateTime(endUtc)}`,
    `SUMMARY:CANCELLED: ${escapeIcs(typeName)} — Kaptivating Homes`,
    `ORGANIZER;CN=${escapeIcs(agentName)}:mailto:${agentEmail}`,
    `STATUS:CANCELLED`,
    `SEQUENCE:${sequence}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return foldIcsLines(lines);
}

// -------------------------------------------------------------------------
// Private helpers
// -------------------------------------------------------------------------

/**
 * Format a Date as iCalendar UTC datetime: 20260503T180000Z
 */
function formatIcsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape special characters in iCal property values.
 * Per RFC 5545: backslash, semicolon, comma, and newline must be escaped.
 */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * iCal lines must not exceed 75 octets (RFC 5545 §3.1).
 * Long lines are folded by inserting CRLF + space.
 */
function foldIcsLines(content: string): string {
  return content
    .split('\r\n')
    .map((line) => {
      if (Buffer.byteLength(line, 'utf8') <= 75) return line;
      const folded: string[] = [];
      let remaining = line;
      while (Buffer.byteLength(remaining, 'utf8') > 75) {
        let splitAt = 75;
        // Don't split in the middle of a multi-byte UTF-8 character
        while (Buffer.byteLength(remaining.slice(0, splitAt), 'utf8') > 75) splitAt--;
        folded.push(remaining.slice(0, splitAt));
        remaining = ' ' + remaining.slice(splitAt);
      }
      folded.push(remaining);
      return folded.join('\r\n');
    })
    .join('\r\n');
}

function buildLocation(appointment: any): string | null {
  const typeName = (appointment.appointment_types?.name ?? '').toLowerCase();
  if (typeName.includes('tour') && appointment.related_listing_id) {
    // Try to get the property address from the appointment's related listing
    // (The route handler should join this data — we use it if present)
    if (appointment.listing_address) {
      return `${appointment.listing_address}, ${appointment.listing_city}, ${appointment.listing_state}`;
    }
  }
  // For consultations and phone calls: no fixed location
  return null;
}

function buildDescription(
  appointment: any,
  typeName:    string,
  clientName:  string,
  siteUrl:     string,
): string {
  const lines: string[] = [];

  lines.push(`${typeName} with ${process.env.AGENT_NAME ?? 'Your Agent'}`);
  lines.push('');

  if (appointment.client_note) {
    lines.push(`Your note: ${appointment.client_note}`);
    lines.push('');
  }

  if (appointment.agent_note) {
    lines.push(`From your agent: ${appointment.agent_note}`);
    lines.push('');
  }

  lines.push(`View appointment details: ${siteUrl}/portal/appointments/${appointment.id}`);
  lines.push(`Questions? Visit: ${siteUrl}/portal/messages`);

  return lines.join('\n');
}
