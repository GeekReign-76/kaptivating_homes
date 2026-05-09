import { createClient } from '@supabase/supabase-js';

/**
 * Supabase service-role client for backend use only.
 * Service role bypasses Row Level Security — only use server-side.
 * Never expose this client or its key to the frontend.
 */
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
);
