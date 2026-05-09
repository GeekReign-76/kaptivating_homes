/**
 * slotCalculator.ts
 *
 * Pure function — no DB calls, no side effects.
 * Takes pre-fetched availability data and returns open time slots.
 *
 * Easy to unit test: provide mock windows/blocks/appointments, assert slots.
 */

import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';
import { addMinutes, isWithinInterval, areIntervalsOverlapping } from 'date-fns';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface AvailabilityWindow {
  day_of_week: number;   // 0=Sun ... 6=Sat
  start_time:  string;   // 'HH:MM:SS' in agent's local timezone
  end_time:    string;   // 'HH:MM:SS' in agent's local timezone
  is_active:   boolean;
}

export interface AvailabilityBlock {
  blocked_date: string;  // 'YYYY-MM-DD'
  start_time:   string | null; // null = entire day blocked
  end_time:     string | null;
}

export interface ExistingAppointment {
  confirmed_start: string; // ISO UTC string
  confirmed_end:   string; // ISO UTC string
  buffer_minutes:  number; // from appointment_type
}

export interface TimeSlot {
  start: string; // ISO UTC string
  end:   string; // ISO UTC string
  // Client displays these in the agent's timezone
}

export interface SlotCalculationParams {
  date:                  Date;    // The specific calendar date to calculate
  agentTimezone:         string;  // IANA timezone e.g. 'America/New_York'
  durationMinutes:       number;
  bufferMinutes:         number;
  availabilityWindows:   AvailabilityWindow[];
  availabilityBlocks:    AvailabilityBlock[];
  existingAppointments:  ExistingAppointment[];
  bookingNoticeMinutes?: number;  // How far ahead client must book (default: 120 min)
}

// -------------------------------------------------------------------------
// calculateAvailableSlots — main export
// -------------------------------------------------------------------------

export function calculateAvailableSlots(params: SlotCalculationParams): TimeSlot[] {
  const {
    date,
    agentTimezone,
    durationMinutes,
    bufferMinutes,
    availabilityWindows,
    availabilityBlocks,
    existingAppointments,
    bookingNoticeMinutes = 120,
  } = params;

  // Determine day of week in the agent's timezone for the given date
  const localDateStr = format(utcToZonedTime(date, agentTimezone), 'yyyy-MM-dd', { timeZone: agentTimezone });
  const localDate    = new Date(`${localDateStr}T00:00:00`);
  const dayOfWeek    = localDate.getDay(); // 0=Sun ... 6=Sat

  // Minimum bookable start time (must be at least bookingNoticeMinutes from now)
  const earliestBookable = addMinutes(new Date(), bookingNoticeMinutes);

  // Active windows for this day of week
  const windowsForDay = availabilityWindows.filter(
    (w) => w.day_of_week === dayOfWeek && w.is_active
  );

  if (windowsForDay.length === 0) return [];

  // Build blocked intervals for the day
  const blockedIntervals = buildBlockedIntervals(
    localDateStr,
    agentTimezone,
    availabilityBlocks,
    existingAppointments,
    bufferMinutes
  );

  const slots: TimeSlot[] = [];

  for (const window of windowsForDay) {
    // Convert window times from agent's local timezone to UTC Date objects
    const windowStartUtc = localTimeToUtc(localDateStr, window.start_time, agentTimezone);
    const windowEndUtc   = localTimeToUtc(localDateStr, window.end_time,   agentTimezone);

    // Walk through the window generating candidate slots
    let slotStart = new Date(windowStartUtc);

    while (true) {
      const slotEnd = addMinutes(slotStart, durationMinutes);

      // Slot must fit entirely within the window
      if (slotEnd > windowEndUtc) break;

      // Slot must be bookable (not in the past, meets notice requirement)
      if (slotStart >= earliestBookable) {
        // Slot must not overlap any blocked interval
        const slotInterval = { start: slotStart, end: slotEnd };
        const isBlocked = blockedIntervals.some((blocked) =>
          areIntervalsOverlapping(slotInterval, blocked, { inclusive: false })
        );

        if (!isBlocked) {
          slots.push({
            start: slotStart.toISOString(),
            end:   slotEnd.toISOString(),
          });
        }
      }

      // Advance by duration + buffer
      slotStart = addMinutes(slotStart, durationMinutes + bufferMinutes);
    }
  }

  return slots;
}

// -------------------------------------------------------------------------
// calculateSlotsForDateRange
//
// Calls calculateAvailableSlots for each date in the range.
// Used by GET /api/v1/availability
// -------------------------------------------------------------------------

export interface DaySlots {
  date:            string;     // 'YYYY-MM-DD' in agent's timezone
  available_times: TimeSlot[];
}

export function calculateSlotsForDateRange(
  startDate:           Date,
  endDate:             Date,
  agentTimezone:       string,
  durationMinutes:     number,
  bufferMinutes:       number,
  availabilityWindows: AvailabilityWindow[],
  availabilityBlocks:  AvailabilityBlock[],
  existingAppointments: ExistingAppointment[],
  bookingNoticeMinutes?: number,
): DaySlots[] {
  const results: DaySlots[] = [];

  const cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (cursor <= end) {
    const dateStr = format(
      utcToZonedTime(cursor, agentTimezone),
      'yyyy-MM-dd',
      { timeZone: agentTimezone }
    );

    // Filter blocks and appointments to only those relevant to this date
    const blocksForDate = availabilityBlocks.filter((b) => b.blocked_date === dateStr);
    const appointmentsForDate = existingAppointments.filter((a) => {
      const apptDate = format(
        utcToZonedTime(new Date(a.confirmed_start), agentTimezone),
        'yyyy-MM-dd',
        { timeZone: agentTimezone }
      );
      return apptDate === dateStr;
    });

    const slots = calculateAvailableSlots({
      date: cursor,
      agentTimezone,
      durationMinutes,
      bufferMinutes,
      availabilityWindows,
      availabilityBlocks:   blocksForDate,
      existingAppointments: appointmentsForDate,
      bookingNoticeMinutes,
    });

    results.push({ date: dateStr, available_times: slots });

    // Advance to next day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

// -------------------------------------------------------------------------
// Private helpers
// -------------------------------------------------------------------------

/**
 * Convert a 'HH:MM:SS' time string on a given YYYY-MM-DD date
 * from the agent's local timezone to a UTC Date object.
 */
function localTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const localDatetime = new Date(`${dateStr}T${pad(hours)}:${pad(minutes)}:00`);
  return zonedTimeToUtc(localDatetime, timezone);
}

/**
 * Build an array of blocked time intervals for conflict checking.
 * Includes availability_blocks AND existing appointments (+ buffer).
 */
function buildBlockedIntervals(
  dateStr:              string,
  agentTimezone:        string,
  availabilityBlocks:   AvailabilityBlock[],
  existingAppointments: ExistingAppointment[],
  bufferMinutes:        number,
): Array<{ start: Date; end: Date }> {
  const intervals: Array<{ start: Date; end: Date }> = [];

  // Blocked dates / time ranges
  for (const block of availabilityBlocks) {
    if (block.blocked_date !== dateStr) continue;

    if (block.start_time === null || block.end_time === null) {
      // Entire day blocked
      intervals.push({
        start: localTimeToUtc(dateStr, '00:00:00', agentTimezone),
        end:   localTimeToUtc(dateStr, '23:59:59', agentTimezone),
      });
    } else {
      intervals.push({
        start: localTimeToUtc(dateStr, block.start_time, agentTimezone),
        end:   localTimeToUtc(dateStr, block.end_time, agentTimezone),
      });
    }
  }

  // Existing appointments — block (appointment duration + buffer)
  for (const appt of existingAppointments) {
    intervals.push({
      start: new Date(appt.confirmed_start),
      end:   addMinutes(new Date(appt.confirmed_end), appt.buffer_minutes ?? bufferMinutes),
    });
  }

  return intervals;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
