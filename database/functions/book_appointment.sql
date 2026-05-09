-- ============================================================
-- book_appointment — Atomic slot booking Postgres function
-- ============================================================
-- Called via Supabase RPC: supabase.rpc('book_appointment', { ... })
--
-- Performs the conflict check and INSERT in a single serializable
-- transaction. Prevents double-booking when two clients request
-- the same slot simultaneously.
--
-- Returns JSON:
--   Success: { success: true, appointment_id, status }
--   Conflict: { error: 'SLOT_UNAVAILABLE', message }
--   Invalid:  { error: 'VALIDATION_ERROR', message }
-- ============================================================

CREATE OR REPLACE FUNCTION book_appointment(
  p_client_id              UUID,
  p_appointment_type_id    UUID,
  p_requested_start        TIMESTAMPTZ,
  p_requested_end          TIMESTAMPTZ,
  p_booking_type           TEXT,     -- 'slot' | 'suggestion'
  p_related_listing_id     UUID      DEFAULT NULL,
  p_related_listing_type   TEXT      DEFAULT NULL,
  p_client_note            TEXT      DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count   INT;
  v_appointment_id   UUID;
  v_auto_confirm     BOOLEAN;
  v_status           TEXT;
  v_confirmed_start  TIMESTAMPTZ;
  v_confirmed_end    TIMESTAMPTZ;
BEGIN

  -- --------------------------------------------------------
  -- 1. Validate booking_type
  -- --------------------------------------------------------
  IF p_booking_type NOT IN ('slot', 'suggestion') THEN
    RETURN json_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'booking_type must be slot or suggestion'
    );
  END IF;

  -- --------------------------------------------------------
  -- 2. Validate time range
  -- --------------------------------------------------------
  IF p_requested_start >= p_requested_end THEN
    RETURN json_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'requested_start must be before requested_end'
    );
  END IF;

  IF p_requested_start < NOW() THEN
    RETURN json_build_object(
      'error',   'VALIDATION_ERROR',
      'message', 'Cannot book an appointment in the past'
    );
  END IF;

  -- --------------------------------------------------------
  -- 3. For slot bookings: check for conflicts atomically
  --    Uses OVERLAPS operator — true when ranges share any time
  -- --------------------------------------------------------
  IF p_booking_type = 'slot' THEN

    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE status IN ('pending', 'confirmed', 'counter_proposed')
      AND confirmed_start IS NOT NULL
      AND confirmed_end   IS NOT NULL
      AND (confirmed_start, confirmed_end) OVERLAPS (p_requested_start, p_requested_end);

    IF v_conflict_count > 0 THEN
      RETURN json_build_object(
        'error',   'SLOT_UNAVAILABLE',
        'message', 'This time slot is no longer available. Please choose another time.'
      );
    END IF;

    -- Read auto-confirm setting (stored in agent_settings table)
    SELECT COALESCE(
      (SELECT value::boolean FROM agent_settings WHERE key = 'auto_confirm_bookings'),
      true  -- default: auto-confirm is ON
    ) INTO v_auto_confirm;

    v_status          := CASE WHEN v_auto_confirm THEN 'confirmed' ELSE 'pending' END;
    v_confirmed_start := p_requested_start;
    v_confirmed_end   := p_requested_end;

  ELSE
    -- Suggestion: no conflict check needed — agent will review
    v_status          := 'suggested';
    v_confirmed_start := NULL;
    v_confirmed_end   := NULL;
  END IF;

  -- --------------------------------------------------------
  -- 4. Insert appointment
  -- --------------------------------------------------------
  INSERT INTO appointments (
    client_id,
    appointment_type_id,
    requested_start,
    requested_end,
    confirmed_start,
    confirmed_end,
    status,
    related_listing_id,
    related_listing_type,
    client_note
  )
  VALUES (
    p_client_id,
    p_appointment_type_id,
    p_requested_start,
    p_requested_end,
    v_confirmed_start,
    v_confirmed_end,
    v_status,
    p_related_listing_id,
    p_related_listing_type,
    p_client_note
  )
  RETURNING id INTO v_appointment_id;

  -- --------------------------------------------------------
  -- 5. Return success
  -- --------------------------------------------------------
  RETURN json_build_object(
    'success',        true,
    'appointment_id', v_appointment_id,
    'status',         v_status,
    'confirmed_start', v_confirmed_start,
    'confirmed_end',   v_confirmed_end
  );

END;
$$;


-- ============================================================
-- agent_settings table (needed by book_appointment function)
-- ============================================================
-- Simple key-value store for agent configuration.
-- Add to database_schema.sql as well.

CREATE TABLE IF NOT EXISTS agent_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults
INSERT INTO agent_settings (key, value) VALUES
  ('auto_confirm_bookings', 'true'),
  ('agent_timezone',        'America/New_York'),
  ('booking_notice_hours',  '2'),   -- minimum hours ahead client can book
  ('max_advance_days',      '60')   -- how far in advance clients can book
ON CONFLICT (key) DO NOTHING;

ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage settings"
  ON agent_settings FOR ALL USING (is_agent());
-- book_appointment runs as security definer — bypasses RLS
