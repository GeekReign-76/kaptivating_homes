import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'sb-qlpxwpajrhwbvecuqpzj-auth-token';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getSessionFromCookies(request: NextRequest): { user: any } | null {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    const accessToken = session?.access_token;
    if (!accessToken) return null;

    const payload = decodeJwtPayload(accessToken);
    if (!payload) return null;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return { user: payload };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = getSessionFromCookies(request);
  const user = session?.user ?? null;

  // Protect /portal — any authenticated user
  if (pathname.startsWith('/portal') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Protect /dashboard — agents only
  if (pathname.startsWith('/dashboard')) {
    const role = user?.user_metadata?.role ?? user?.role ?? null;
    if (!user || role !== 'agent') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
