# Appointment Booking System — Architecture & Design

**Last updated:** 2026-04-29

---

## Table of Contents

1. [State Machine](#1-state-machine)
2. [Slot Calculation Algorithm](#2-slot-calculation-algorithm)
3. [Race Condition & Atomic Booking](#3-race-condition--atomic-booking)
4. [Timezone Handling](#4-timezone-handling)
5. [Auto-Confirm Setting](#5-auto-confirm-setting)
6. [Counter-Propose Flow](#6-counter-propose-flow)
7. [Calendar Invite (.ics)](#7-calendar-invite-ics)
8. [Notification Triggers](#8-notification-triggers)
9. [File Structure](#9-file-structure)

---

## 1. State Machine

Every appointment has a `status` field. These are the only valid transitions:

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
           [client books open slot]          [client suggests custom time]
                    │                                         │
                    ▼                                         ▼
               PENDING ────────────────────────────────► SUGGESTED
                  │   (agent has auto-confirm off)             │
                  │                                            │
         ┌────────┼────────┐                    ┌─────────────┼──────────────┐
         │        │        │                    │             │              │
         ▼        ▼        ▼                    ▼             ▼              ▼
    CONFIRMED  CANCELLED  (agent         CONFIRMED     COUNTER_          CANCELLED
               _AGENT     auto-           (agent        PROPOSED          _AGENT
                          confirms)       accepts)      (agent            (agent
                                                        counters)         declines)
                                                           │
                                                 ┌─────────┴─────────┐
                                                 │                   │
                                                 ▼                   ▼
                                            CONFIRMED          CANCELLED
                                          (client accepts)      _CLIENT
                                                                (client
                                                                declines)
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
     COMPLETED          NO_SHOW
```

### Valid transitions table

| From | To | Who | Trigger |
|---|---|---|---|
| — | `pending` | client | Books an open slot |
| — | `suggested` | client | Suggests a custom time |
| `pending` | `confirmed` | agent | Manually confirms |
| `pending` | `confirmed` | system | Auto-confirm enabled |
| `pending` | `cancelled_agent` | agent | Declines the booking |
| `suggested` | `confirmed` | agent | Accepts the suggestion |
| `suggested` | `counter_proposed` | agent | Proposes different time |
| `suggested` | `cancelled_agent` | agent | Declines the suggestion |
| `counter_proposed` | `confirmed` | client | Accepts the counter |
| `counter_proposed` | `cancelled_client` | client | Declines the counter |
| `confirmed` | `cancelled_client` | client | Client cancels |
| `confirmed` | `cancelled_agent` | agent | Agent cancels |
| `confirmed` | `completed` | agent | Marks complete after meeting |
| `confirmed` | `no_show` | agent | Client didn't show up |

Any other transition is rejected with a `422 INVALID_TRANSITION` error.

---

## 2. Slot Calculation Algorithm

The slot calculator is a **pure function** — no DB calls. It takes pre-fetched data as input and returns an array of available time slots.

### Inputs

```
calculateAvailableSlots({
  date,               // The date to calculate (Date object)
  agentTimezone,      // 'America/New_York'
  durationMinutes,    // Appointment type duration (e.g. 90)
  bufferMinutes,      // Buffer after appointment (e.g. 15)
  availabilityWindows, // Rows from availability_windows for this day_of_week
  availabilityBlocks,  // Rows from availability_blocks for this date
  existingAppointments // Confirmed + pending appointments for this date
})
→ TimeSlot[]
```

### Algorithm (step by step)

```
For each availability window on this day:

  1. Convert window start/end times from agent's local timezone → UTC
     e.g. "9:00 AM Eastern" → UTC equivalent for that specific date

  2. Walk through the window in steps of (duration + buffer):
     start = windowStart
     while (start + duration) <= windowEnd:
       candidate = { start, end: start + duration }
       start += (duration + buffer)

  3. For each candidate slot:
     a. Does it overlap with any availability_block? → skip
     b. Does it overlap with any existing appointment (including its buffer)? → skip
     c. Does it fit entirely within the window? → (guaranteed by step 2)

  4. Remaining candidates are available slots
```

### Overlap check

Two time ranges `[A_start, A_end)` and `[B_start, B_end)` overlap if:
```
A_start < B_end AND A_end > B_start
```

For appointments we also check the buffer:
```
A_start < (B_end + bufferMinutes) AND A_end > B_start
```

### Example

```
Window:   9:00 AM – 6:00 PM Eastern (13 Dec 2026)
Type:     Home Tour — 90 min duration, 15 min buffer
Step:     105 min

Candidates:  9:00, 10:45, 12:30, 2:15, 4:00, 5:45
             (5:45 + 1:30 = 7:15 → exceeds 6:00 PM window → excluded)
Candidates:  9:00, 10:45, 12:30, 2:15, 4:00

Existing:    Buyer Consultation confirmed at 10:30 AM (60 min + 15 min buffer → blocked until 11:45)
             10:45 AM slot overlaps 10:30–11:45 → excluded

Available:   9:00, 12:30, 2:15, 4:00
```

---

## 3. Race Condition & Atomic Booking

### The problem

Two clients could request the same slot within milliseconds of each other:
- Client A: checks availability → slot is free
- Client B: checks availability → slot is free
- Client A: creates appointment
- Client B: creates appointment  ← double-booking!

### The solution: Postgres RPC function

The booking is handled by a **single atomic Postgres function** (`book_appointment`) that does the conflict check and the INSERT in the same transaction with a serializable isolation level.

If two requests hit simultaneously:
- One transaction wins — gets the slot
- The other sees the conflict during its check and returns `SLOT_UNAVAILABLE`
- No double-booking possible

The function is called via Supabase `.rpc('book_appointment', { ... })`.

### The conflict check in the function

```sql
-- Check if any confirmed/pending appointment overlaps the requested window
SELECT COUNT(*) INTO v_conflict_count
FROM appointments
WHERE status IN ('pending', 'confirmed', 'counter_proposed')
  AND (confirmed_start, confirmed_end) OVERLAPS (p_requested_start, p_requested_end);
```

We check `confirmed_start / confirmed_end` (not `requested_start`) because those are what's actually blocked on the calendar.

---

## 4. Timezone Handling

### Storage
All times in PostgreSQL are stored as `TIMESTAMPTZ` (UTC). No exceptions.

### Agent timezone
The agent has a `timezone` setting (e.g. `'America/New_York'`). Default: `'America/New_York'`.
Stored in a `settings` table (key-value).

### Slot display to clients
- Slots are returned as UTC ISO strings from the API
- The frontend converts to the agent's timezone for display:
  ```
  "Available times are shown in Eastern Time (ET)"
  ```
- Using `Intl.DateTimeFormat` with the agent's timezone

### Availability window interpretation
`availability_windows.start_time` (e.g. `09:00:00`) means 9 AM in the **agent's local timezone**.
When calculating slots for a specific date, the slot calculator converts window times to UTC using the agent's timezone for that exact date (accounts for DST).

Example:
- Agent timezone: `America/New_York`
- Date: March 8, 2026 (day before DST spring-forward)
- Window: `09:00` → UTC `14:00` (EST, UTC-5)
- Date: March 9, 2026 (day of DST)
- Window: `09:00` → UTC `13:00` (EDT, UTC-4)

The slot calculator uses the `Temporal` API (or `date-fns-tz`) to handle this correctly.

---

## 5. Auto-Confirm Setting

Agent can toggle "Auto-confirm bookings" in dashboard settings.

| Setting | Behavior |
|---|---|
| Auto-confirm ON | Open slot bookings → immediately `confirmed`. Client gets confirmation immediately. Agent is notified but no action required. |
| Auto-confirm OFF | Open slot bookings → `pending`. Agent must manually confirm. Client sees "Pending confirmation" status. |

Suggestions (custom times) are **never** auto-confirmed — they always require agent review.

---

## 6. Counter-Propose Flow

Full sequence when agent counter-proposes:

```
1. Client submits SUGGESTION for Sat May 10, 6:00 PM
   → appointment.status = 'suggested'
   → Agent gets push: "New time request from Jane Smith — Sat May 10, 6:00 PM"

2. Agent reviews in dashboard calendar
   → Clicks "Propose different time"
   → Selects Sat May 10, 10:00 AM instead
   → PATCH /api/v1/appointments/:id/counter { counter_start, counter_end, agent_note }
   → appointment.status = 'counter_proposed'
   → appointment.counter_start = May 10 10:00 AM
   → Client gets push: "Agent suggested May 10 at 10:00 AM instead"

3. Client reviews counter-proposal in portal
   Two options:
   A. Accept → PATCH /api/v1/appointments/:id/accept-counter
              → confirmed_start = counter_start, confirmed_end = counter_end
              → appointment.status = 'confirmed'
              → Both get confirmation notification + calendar invite
   B. Decline → PATCH /api/v1/appointments/:id/cancel { reason }
              → appointment.status = 'cancelled_client'
              → Agent notified
```

Clients cannot counter-propose back. If they decline a counter, they start a new booking.

---

## 7. Calendar Invite (.ics)

A `.ics` (iCalendar) file is generated and attached to confirmation emails so both parties can add the appointment to Google Calendar, Apple Calendar, or Outlook.

### .ics content

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kaptivating Homes//Appointment//EN
BEGIN:VEVENT
UID:{appointment_id}@kaptivatinghomes.com
DTSTAMP:{now in UTC, format: 20260503T180000Z}
DTSTART:{confirmed_start in UTC}
DTEND:{confirmed_end in UTC}
SUMMARY:{appointment_type} with {agent_name}
DESCRIPTION:{client_note if any}\n\nLocation: {address if home tour}
LOCATION:{property address if home tour, else "To be confirmed"}
ORGANIZER;CN={agent_name}:mailto:{agent_email}
ATTENDEE;CN={client_name}:mailto:{client_email}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: {appointment_type} in 1 hour
END:VALARM
END:VEVENT
END:VCALENDAR
```

### Update sequence
When an appointment is rescheduled (counter-proposal accepted), the `.ics` is regenerated with `SEQUENCE:1` (incremented). Most calendar apps handle this as an update to the existing event rather than creating a duplicate.

---

## 8. Notification Triggers

| Event | Who notified | Type |
|---|---|---|
| Slot booked (pending) | Agent | `time_suggestion_received` (agent action needed) |
| Slot booked (auto-confirmed) | Client + Agent | `appointment_confirmed` |
| Agent confirms pending | Client | `appointment_confirmed` |
| Agent declines pending | Client | `appointment_cancelled_agent` |
| Suggestion received | Agent | `time_suggestion_received` |
| Agent accepts suggestion | Client | `appointment_confirmed` |
| Agent counter-proposes | Client | `time_suggestion_response` |
| Client accepts counter | Agent + Client | `appointment_confirmed` |
| Client declines counter | Agent | `appointment_cancelled_client` |
| Agent cancels confirmed | Client | `appointment_cancelled_agent` |
| Client cancels confirmed | Agent | `appointment_cancelled_client` |
| 24h before confirmed | Agent + Client | `appointment_reminder_24h` |
| 1h before confirmed | Agent + Client | `appointment_reminder_1h` |

---

## 9. File Structure

```
backend/src/
├── services/
│   ├── slotCalculator.ts        Pure slot calculation function
│   ├── appointmentService.ts    Business logic — state transitions, notifications
│   └── calendarInvite.ts        .ics file generation
├── routes/
│   └── appointments.ts          Express route handlers
database/functions/
└── book_appointment.sql         Atomic booking Postgres function (called via Supabase RPC)
```
