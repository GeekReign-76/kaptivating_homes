/**
 * Supabase server client — used in Server Components, Route Handlers, Server Actions.
 * Creates a new instance per request (as required by @supabase/ssr).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies }            from 'next/headers';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !key) return null;

  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as any);
          });
        } catch {
          // Can be called from Server Components — read-only cookies, ignore
        }
      },
    },
  });
}
