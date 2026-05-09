/**
 * /auth/callback — handles Supabase magic link and OAuth redirects.
 * After Supabase verifies the token, it redirects here.
 * We exchange the code for a session, then redirect to the intended destination.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/portal';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase?.auth.exchangeCodeForSession(code) ?? {};
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send to login with an error param
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
