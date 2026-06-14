/**
 * /auth/callback — handles Supabase magic link and OAuth redirects.
 * After Supabase verifies the token, it redirects here.
 * We exchange the code for a session, then redirect to the intended destination.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/portal';

  // In standalone mode behind Apache, request.url contains the internal binding
  // address (http://0.0.0.0:4712). Derive the public origin from forwarded headers.
  const forwardedHost  = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const publicOrigin   = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api-server\/?$/, '');

  if (code) {
    const supabase = createClient();
    const { error } = await supabase?.auth.exchangeCodeForSession(code) ?? {};
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${next}`);
    }
  }

  // Something went wrong — send to login with an error param
  return NextResponse.redirect(`${publicOrigin}/auth/login?error=auth_failed`);
}
